/**
 * The read-only schema catalogue used by the migration workflow to verify a
 * database against the repository migrations (supabase/ops/catalogue.sql).
 */
import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASELINE_LAST, applyMigrations, as, createDb, signUp } from "./harness";

const FILE = readFileSync(join(__dirname, "..", "ops", "catalogue.sql"), "utf8");
// The schema query, without psql meta-commands (the workflow runs the whole file with psql).
const QUERY = FILE.slice(FILE.indexOf("with lines(line) as ("), FILE.indexOf('order by line collate "C";') + 'order by line collate "C"'.length);

async function catalogue(db: PGlite): Promise<string[]> {
  await db.exec("begin transaction read only");
  try {
    return (await db.query<{ line: string }>(QUERY)).rows.map((r) => r.line);
  } finally {
    await db.exec("rollback");
  }
}

let fresh: PGlite;
let upgraded: PGlite;

beforeAll(async () => {
  fresh = await createDb();
  // A database that ran the six production migrations, holds data, then received the Step 1 migrations.
  upgraded = await createDb({ upTo: BASELINE_LAST });
  const s = await signUp(upgraded, { email: "existing@example.com", meta: { terms_version: "draft-2026-11" } });
  await as(upgraded, s, "select public.set_employer_visibility(true)");
  await applyMigrations(upgraded, { after: BASELINE_LAST });
}, 120_000);

afterAll(async () => {
  await fresh?.close();
  await upgraded?.close();
});

describe("schema catalogue", () => {
  it("covers every kind of object the migrations create", async () => {
    const lines = await catalogue(fresh);
    for (const prefix of ["extension|", "relation|", "column|", "constraint|", "index|", "policy|", "function|", "execute|", "grant|", "column_grant|", "trigger|", "enum|", "bucket|"]) {
      expect(lines.some((l) => l.startsWith(prefix)), prefix).toBe(true);
    }
    expect(lines).toContain("relation|accounts|r|rls=true|force=false");
    expect(lines.some((l) => l.startsWith("trigger|auth.users|on_auth_user_account_created|"))).toBe(true);
  });

  it("is identical for a fresh database and an upgraded one holding data", async () => {
    expect(await catalogue(upgraded)).toEqual(await catalogue(fresh));
  });

  it("detects a changed function, policy, grant or column", async () => {
    const before = await catalogue(upgraded);
    await upgraded.exec("create or replace function public.company_is_writable(p_company uuid) returns boolean language sql stable security definer set search_path = '' as $$ select true $$");
    await upgraded.exec("grant execute on function public.accept_invitation(text) to anon");
    await upgraded.exec("alter table public.companies add column extra text");
    await upgraded.exec("drop policy \"Admins read accounts\" on public.accounts");
    const after = await catalogue(upgraded);
    const changed = after.filter((l) => !before.includes(l)).concat(before.filter((l) => !after.includes(l)));
    expect(changed.some((l) => l.startsWith("function|company_is_writable"))).toBe(true);
    expect(changed.some((l) => l.startsWith("execute|accept_invitation"))).toBe(true);
    expect(changed.some((l) => l.startsWith("column|companies.extra"))).toBe(true);
    expect(changed.some((l) => l.startsWith("policy|public.accounts|Admins read accounts"))).toBe(true);
  });

  it("runs in a read-only transaction", async () => {
    await fresh.exec("begin transaction read only");
    await expect(fresh.query("insert into public.provinces (code, name_en, name_pt) values ('x', 'x', 'x')")).rejects.toThrow(/read-only/);
    await fresh.exec("rollback");
  });
});
