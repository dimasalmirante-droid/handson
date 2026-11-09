/**
 * Module 2 Step 1: Terms and Privacy Notice versions and acceptance.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDb, expectDenied, makeAdmin, signUp } from "./harness";

let db: PGlite;
let SUPER: string;
let ADMIN: string;
let USER: string;

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

async function draft(kind: "terms" | "privacy", version: string, effective: string) {
  const { rows } = await as<{ id: string }>(
    db,
    SUPER,
    "select public.admin_save_legal_draft(null, $1, $2, $3, 'What changed', $4, $5) as id",
    [kind, version, kind === "terms" ? "Terms and Conditions" : "Privacy Notice", `Full text of ${kind} ${version}`, effective],
  );
  return rows[0].id;
}
async function publish(id: string) {
  await as(db, SUPER, "select public.admin_publish_legal_document($1)", [id]);
}
async function status(user: string) {
  const { rows } = await as<{ s: { active: boolean; required: { id: string; kind: string }[] } }>(db, user, "select public.legal_acceptance_status() s");
  return rows[0].s;
}

beforeAll(async () => {
  db = await createDb();
  SUPER = await signUp(db, { email: "super@handson.cloud" });
  ADMIN = await signUp(db, { email: "admin@handson.cloud" });
  USER = await signUp(db, { email: "google.user@example.com", provider: "google" });
  await makeAdmin(db, SUPER, "super_admin");
  await makeAdmin(db, ADMIN, "admin");
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("legal documents", () => {
  let terms1: string;
  let privacy1: string;

  it("nothing is required while no final documents are in force", async () => {
    expect(await status(USER)).toEqual({ active: false, required: [] });
    const { rows } = await as(db, null, "select * from public.current_legal_documents()");
    expect(rows).toHaveLength(0);
  });

  it("only super admins manage documents; drafts are invisible to everyone else", async () => {
    await expectDenied(db, ADMIN, "select public.admin_save_legal_draft(null, 'terms', 'v1', 'Terms', null, 'Body', now())", [], /Not authorised/);
    terms1 = await draft("terms", "1.0", ago(1));
    const asUser = await as(db, USER, "select * from public.legal_documents");
    const asAnon = await as(db, null, "select * from public.legal_documents");
    expect([asUser.rows.length, asAnon.rows.length]).toEqual([0, 0]);
    const asSuper = await as(db, SUPER, "select id from public.legal_documents");
    expect(asSuper.rows).toEqual([{ id: terms1 }]);
  });

  it("a draft cannot be accepted", async () => {
    await expectDenied(db, USER, "select public.accept_legal_documents($1, null)", [terms1], /not yet in force/);
  });

  it("stays off while only one document is published and effective", async () => {
    await publish(terms1);
    expect(await status(USER)).toEqual({ active: false, required: [] });
    await expectDenied(db, USER, "select public.accept_legal_documents($1, null)", [terms1], /not yet in force/);
  });

  it("stays off while the second document is published but not yet effective", async () => {
    const future = await draft("privacy", "1.0", ahead(5));
    await publish(future);
    expect((await status(USER)).active).toBe(false);
    privacy1 = future;
  });

  it("switches on once both are published and effective, requiring both", async () => {
    // A version with an earlier effective date than the scheduled one cannot be published.
    const effective = await draft("privacy", "1.0.1", ago(0.5));
    await expectDenied(db, SUPER, "select public.admin_publish_legal_document($1)", [effective], /later than/);
    await as(db, SUPER, "select public.admin_delete_legal_draft($1)", [effective]);
    // Simulate time passing: the scheduled version becomes effective.
    await db.exec("alter table public.legal_documents disable trigger legal_documents_guard");
    await db.query("update public.legal_documents set effective_at = now() - interval '1 minute' where id = $1", [privacy1]);
    await db.exec("alter table public.legal_documents enable trigger legal_documents_guard");
    const s = await status(USER);
    expect(s.active).toBe(true);
    expect(s.required.map((d) => d.kind)).toEqual(["terms", "privacy"]);
  });

  it("published versions cannot be changed or deleted", async () => {
    await expect(db.query("update public.legal_documents set body = 'changed' where id = $1", [terms1])).rejects.toThrow(/cannot be changed/);
    await expect(db.query("delete from public.legal_documents where id = $1", [terms1])).rejects.toThrow(/cannot be deleted/);
    await expectDenied(db, SUPER, "select public.admin_save_legal_draft($1, 'terms', '1.0', 'Terms', null, 'x', now())", [terms1], /already published/);
  });

  it("anyone can read published versions", async () => {
    const { rows } = await as<{ version: string }>(db, null, "select version from public.legal_documents order by kind");
    expect(rows.map((r) => r.version)).toEqual(["1.0", "1.0"]);
  });

  it("records Terms acceptance and Privacy acknowledgement as separate rows", async () => {
    await as(db, USER, "select public.accept_legal_documents($1, $2)", [terms1, privacy1]);
    const { rows } = await db.query<{ consent_type: string; action: string; document_id: string; version: string }>(
      "select consent_type, action, document_id, version from public.consent_records where user_id = $1 order by consent_type",
      [USER],
    );
    expect(rows).toEqual([
      { consent_type: "terms", action: "accepted", document_id: terms1, version: "1.0" },
      { consent_type: "privacy", action: "acknowledged", document_id: privacy1, version: "1.0" },
    ]);
    expect(await status(USER)).toEqual({ active: true, required: [] });
  });

  it("repeating an acceptance has no effect", async () => {
    await as(db, USER, "select public.accept_legal_documents($1, $2)", [terms1, privacy1]);
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from public.consent_records where user_id = $1", [USER]);
    expect(rows[0].n).toBe(2);
  });

  it("only the exact current version of each kind is accepted", async () => {
    const other = await signUp(db, { email: "other@example.com" });
    await expectDenied(db, other, "select public.accept_legal_documents($1, null)", [privacy1], /no longer current/); // wrong kind
    await expectDenied(db, other, "select public.accept_legal_documents(gen_random_uuid(), null)", [], /no longer current/);
    const terms2 = await draft("terms", "2.0", ahead(30));
    await expectDenied(db, other, "select public.accept_legal_documents($1, null)", [terms2], /no longer current/); // draft
    await publish(terms2);
    await expectDenied(db, other, "select public.accept_legal_documents($1, null)", [terms2], /no longer current/); // not yet effective
    await expectDenied(db, other, "select public.accept_legal_documents(null, null)", [], /at least one/);
  });

  it("when only one document changes, only that one needs action", async () => {
    const privacy2 = await draft("privacy", "2.0", ahead(1));
    await publish(privacy2);
    await db.exec("alter table public.legal_documents disable trigger legal_documents_guard");
    await db.query("update public.legal_documents set effective_at = now() - interval '1 second' where id = $1", [privacy2]);
    await db.exec("alter table public.legal_documents enable trigger legal_documents_guard");
    const s = await status(USER);
    expect(s.required).toEqual([expect.objectContaining({ id: privacy2, kind: "privacy" })]);
    await expectDenied(db, USER, "select public.accept_legal_documents(null, $1)", [privacy1], /no longer current/); // old version
    await as(db, USER, "select public.accept_legal_documents(null, $1)", [privacy2]);
    expect((await status(USER)).required).toEqual([]);
  });

  it("the registration form's document ids are recorded only when they are still current", async () => {
    const current = await as<{ id: string; kind: string }>(db, null, "select id, kind from public.current_legal_documents()");
    const ids = Object.fromEntries(current.rows.map((r) => [r.kind, r.id]));
    const ok = await signUp(db, {
      email: "registers@example.com",
      meta: { first_name: "Zito", legal_terms_id: ids.terms, legal_privacy_id: ids.privacy, signup_intent: "student" },
    });
    expect((await status(ok)).required).toEqual([]);
    const stale = await signUp(db, {
      email: "stale.form@example.com",
      meta: { legal_terms_id: ids.terms, legal_privacy_id: privacy1 },
    });
    expect((await status(stale)).required.map((d) => d.kind)).toEqual(["terms", "privacy"]);
    const junk = await signUp(db, { email: "junk@example.com", meta: { legal_terms_id: "not-a-uuid", legal_privacy_id: "'; drop" } });
    expect((await status(junk)).required).toHaveLength(2);
  });

  it("legacy draft acceptances do not count as acceptance of a final version", async () => {
    const legacy = await signUp(db, { email: "legacy@example.com", meta: { terms_version: "draft-2026-11" } });
    expect((await status(legacy)).required.map((d) => d.kind)).toEqual(["terms", "privacy"]);
  });

  it("optional consents are separate and unaffected", async () => {
    await as(db, USER, "select public.set_employer_visibility(true)");
    await as(db, USER, "select public.record_consent('marketing', true, 'v1')");
    expect((await status(USER)).required).toEqual([]);
    const { rows } = await db.query<{ consent_type: string; document_id: string | null }>(
      "select consent_type, document_id from public.consent_records where user_id = $1 and consent_type in ('employer_visibility', 'marketing')",
      [USER],
    );
    expect(rows.every((r) => r.document_id === null)).toBe(true);
  });

  it("suspended accounts cannot accept", async () => {
    const s = await signUp(db, { email: "suspended.legal@example.com" });
    await as(db, ADMIN, "select public.admin_set_user_status($1, 'suspended', 'Test')", [s]);
    const current = await as<{ id: string }>(db, null, "select id from public.current_legal_documents() where kind = 'terms'");
    await expectDenied(db, s, "select public.accept_legal_documents($1, null)", [current.rows[0].id], /suspended/);
  });

  it("publishing is audited", async () => {
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from public.audit_logs where action = 'legal.published'");
    expect(rows[0].n).toBe(4);
  });
});

describe("consent history safeguards", () => {
  it("rejects inconsistent account and profile identifiers", async () => {
    const a = await signUp(db, { email: "pair.a@example.com" });
    const b = await signUp(db, { email: "pair.b@example.com" });
    await expect(
      db.query("insert into public.consent_records (user_id, profile_id, consent_type, granted, version) values ($1, $2, 'marketing', true, 'v')", [a, b]),
    ).rejects.toThrow(/consent_records_profile_matches_user/);
  });

  it("rejects a profile_id with no matching profile", async () => {
    const google = await signUp(db, { email: "no.profile@example.com", provider: "google" });
    await db.query("delete from public.profiles where id = $1", [google]);
    await expect(
      db.query("insert into public.consent_records (profile_id, consent_type, granted, version) values ($1, 'marketing', true, 'v')", [google]),
    ).rejects.toThrow();
  });

  it("deleting a student profile keeps the account's consent history", async () => {
    const s = await signUp(db, { email: "keeps.history@example.com", meta: { terms_version: "draft-2026-11" } });
    await as(db, s, "select public.set_employer_visibility(true)");
    await db.query("delete from public.profiles where id = $1", [s]);
    const { rows } = await db.query<{ user_id: string; profile_id: string | null }>(
      "select user_id, profile_id from public.consent_records where user_id = $1",
      [s],
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.user_id === s && r.profile_id === null)).toBe(true);
  });

  it("deleting the account removes its consent history, as documented", async () => {
    const s = await signUp(db, { email: "deleted.account@example.com", meta: { terms_version: "draft-2026-11" } });
    await db.query("delete from auth.users where id = $1", [s]);
    const { rows } = await db.query("select 1 from public.consent_records where user_id = $1", [s]);
    expect(rows).toHaveLength(0);
  });

  it("each account reads only its own history, through either column", async () => {
    const a = await signUp(db, { email: "reader.a@example.com", meta: { terms_version: "draft-2026-11" } });
    const own = await as<{ user_id: string }>(db, a, "select user_id from public.consent_records");
    expect(new Set(own.rows.map((r) => r.user_id))).toEqual(new Set([a]));
    const legacy = await as(db, a, "select id from public.consent_records where profile_id = $1", [a]);
    expect(legacy.rows).toHaveLength(2);
  });
});
