/**
 * Module 2 Step 1: applying the four new migrations to a database that
 * already holds data from the current application, one migration at a time.
 *
 * Checks that existing data is preserved, that no account is ever without an
 * `accounts` record, and that consent history stays readable throughout.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASELINE_LAST, applyMigrations, as, createDb, hasAccount, signUp } from "./harness";

const M1 = "20261110000100";
const M2 = "20261110000200";
const M3 = "20261110000300";
const M4 = "20261110000400";

let db: PGlite;
const before: Record<string, string> = {};
let consentSnapshot: unknown[] = [];

beforeAll(async () => {
  db = await createDb({ upTo: BASELINE_LAST });
  // Data created by the current application.
  before.email = await signUp(db, {
    email: "email.student@example.com",
    meta: { first_name: "Eva", surname: "Mondlane", terms_version: "draft-2026-11" },
  });
  before.google = await signUp(db, { email: "google.student@example.com", provider: "google" });
  before.suspended = await signUp(db, { email: "suspended@example.com" });
  before.admin = await signUp(db, { email: "admin@handson.cloud" });
  await db.query("insert into public.administrator_roles (user_id, role) values ($1, 'admin')", [before.admin]);
  await as(db, before.admin, "select public.admin_set_account_status($1, 'suspended', 'Test')", [before.suspended]);
  await as(db, before.email, "select public.set_employer_visibility(true)");
  consentSnapshot = (
    await db.query("select id, profile_id, consent_type, granted, version, source, created_at from public.consent_records order by id")
  ).rows;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("applying the Step 1 migrations in order", () => {
  it("migration 1 fills user_id for every consent record without changing them", async () => {
    await applyMigrations(db, { after: BASELINE_LAST, upTo: M1 });
    const rows = (
      await db.query<{ user_id: string; profile_id: string }>(
        "select id, profile_id, consent_type, granted, version, source, created_at, user_id from public.consent_records order by id",
      )
    ).rows;
    expect(rows.map((r) => {
      const copy: Record<string, unknown> = { ...r };
      delete copy.user_id;
      return copy;
    })).toEqual(consentSnapshot);
    for (const r of rows) expect(r.user_id).toBe(r.profile_id);
  });

  it("migration 2 keeps the current registration behaviour", async () => {
    await applyMigrations(db, { after: M1, upTo: M2 });
    const id = await signUp(db, {
      email: "between-2-and-3@example.com",
      meta: { first_name: "Rui", surname: "Nhaca", terms_version: "draft-2026-11" },
    });
    const consent = await db.query<{ consent_type: string; profile_id: string }>(
      "select consent_type, profile_id from public.consent_records where user_id = $1 order by consent_type",
      [id],
    );
    expect(consent.rows).toEqual([
      { consent_type: "terms", profile_id: id },
      { consent_type: "privacy", profile_id: id },
    ]);
    before.between = id;
  });

  it("migration 3 creates an account record for every existing user, keeping suspensions", async () => {
    await applyMigrations(db, { after: M2, upTo: M3 });
    const { rows } = await db.query<{ n: number; a: number }>(
      "select (select count(*)::int from auth.users) n, (select count(*)::int from public.accounts) a",
    );
    expect(rows[0].a).toBe(rows[0].n);
    const status = await db.query<{ user_id: string; status: string }>("select user_id, status from public.accounts");
    const byId = Object.fromEntries(status.rows.map((r) => [r.user_id, r.status]));
    expect(byId[before.suspended]).toBe("suspended");
    expect(byId[before.email]).toBe("active");
    expect(byId[before.between]).toBe("active");
  });

  it("from migration 3 on, every new sign-up gets an account record", async () => {
    const id = await signUp(db, { email: "after-3@example.com" });
    expect(await hasAccount(db, id)).toBe(true);
    const google = await signUp(db, { email: "after-3-google@example.com", provider: "google" });
    expect(await hasAccount(db, google)).toBe(true);
  });

  it("a sign-up whose account record cannot be created is rolled back entirely", async () => {
    const id = "00000000-0000-4000-9000-0000000badad";
    await db.exec(`alter table public.accounts add constraint test_block check (user_id <> '${id}')`);
    await expect(signUp(db, { id, email: "blocked@example.com" })).rejects.toThrow();
    await db.exec("alter table public.accounts drop constraint test_block");
    const { rows } = await db.query("select 1 from auth.users where id = $1", [id]);
    expect(rows).toHaveLength(0);
  });

  it("migration 4 restores any missing account record and verifies the trigger", async () => {
    const id = await signUp(db, { email: "lost-record@example.com" });
    await db.query("delete from public.accounts where user_id = $1", [id]);
    await applyMigrations(db, { after: M3, upTo: M4 });
    expect(await hasAccount(db, id)).toBe(true);
    const { rows } = await db.query<{ n: number; a: number }>(
      "select (select count(*)::int from auth.users) n, (select count(*)::int from public.accounts) a",
    );
    expect(rows[0].a).toBe(rows[0].n);
  });

  it("after migration 4, sign-ups of every kind still get an account record", async () => {
    const email = await signUp(db, { email: "after-4@example.com", meta: { signup_intent: "student" } });
    const google = await signUp(db, { email: "after-4-google@example.com", provider: "google" });
    expect(await hasAccount(db, email)).toBe(true);
    expect(await hasAccount(db, google)).toBe(true);
  });

  it("the account trigger fires before the profile trigger", async () => {
    const { rows } = await db.query<{ tgname: string }>(`
      select tgname from pg_trigger
      where tgrelid = 'auth.users'::regclass and not tgisinternal and (tgtype & 4) = 4
      order by tgname collate "C"`);
    expect(rows.map((r) => r.tgname)).toEqual(["on_auth_user_account_created", "on_auth_user_created"]);
  });

  it("migration 4 refuses to complete if the account trigger is missing", async () => {
    const fresh = await createDb({ upTo: M3 });
    await fresh.exec("drop trigger on_auth_user_account_created on auth.users");
    await expect(applyMigrations(fresh, { after: M3, upTo: M4 })).rejects.toThrow(/account trigger|missing or disabled/);
    const { rows } = await fresh.query("select to_regclass('public.companies') as t");
    expect((rows[0] as { t: string | null }).t).toBeNull(); // nothing from migration 4 was applied
    await fresh.close();
  });

  it("existing consent history and settings are unchanged after all four migrations", async () => {
    const rows = (
      await db.query("select id, profile_id, consent_type, granted, version, source, created_at from public.consent_records where id = any($1) order by id", [
        consentSnapshot.map((r) => (r as { id: string }).id),
      ])
    ).rows;
    expect(rows).toEqual(consentSnapshot);
    const vis = await db.query<{ employer_visibility: boolean; account_status: string }>(
      "select employer_visibility, account_status from public.profiles where id = $1",
      [before.email],
    );
    expect(vis.rows[0]).toEqual({ employer_visibility: true, account_status: "active" });
    const sus = await db.query<{ account_status: string }>("select account_status from public.profiles where id = $1", [before.suspended]);
    expect(sus.rows[0].account_status).toBe("suspended");
  });
});
