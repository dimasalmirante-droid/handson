/**
 * Backward compatibility with the application currently in production.
 *
 * Runs the same scripted journey — the database queries and function calls
 * the deployed application makes (registration, login checks, onboarding,
 * uploads, consent history, employer visibility, administration) — against
 * two databases: one with only the six production migrations, and one with
 * all migrations including Module 2 Step 1. The results must be identical.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASELINE_LAST, as, createDb, signUp } from "./harness";

const STUDENT = "00000000-0000-4000-8000-0000000000c1";
const GOOGLE = "00000000-0000-4000-8000-0000000000c2";
const ADMIN = "00000000-0000-4000-8000-0000000000c3";
const SUPER = "00000000-0000-4000-8000-0000000000c4";
const KNOWN = new Set([STUDENT, GOOGLE, ADMIN, SUPER]);

type Step = { name: string; result: unknown };

async function run(db: PGlite, uid: string | null, sql: string, params: unknown[] = []) {
  try {
    return (await as(db, uid, sql, params)).rows;
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** The deployed application's database calls, in the order a real journey makes them. */
async function journey(db: PGlite): Promise<Step[]> {
  const steps: Step[] = [];
  const step = async (name: string, uid: string | null, sql: string, params: unknown[] = []) =>
    steps.push({ name, result: await run(db, uid, sql, params) });

  // Registration (email form with Terms metadata) and Google sign-up.
  await signUp(db, { id: STUDENT, email: "eva@example.com", meta: { first_name: "Eva", surname: "Mondlane", terms_version: "draft-2026-11" } });
  await signUp(db, { id: GOOGLE, email: "gil@example.com", provider: "google" });
  await signUp(db, { id: ADMIN, email: "admin@handson.cloud" });
  await signUp(db, { id: SUPER, email: "super@handson.cloud" });
  await db.query("insert into public.administrator_roles (user_id, role) values ($1, 'admin'), ($2, 'super_admin')", [ADMIN, SUPER]);

  const PROFILE_COLUMNS =
    "id, email, first_name, middle_name, surname, date_of_birth, gender, nationality_code, country_code, province_id, city, phone, photo_path, linkedin_url, github_url, portfolio_url, employer_visibility, verification_status, onboarding_step, onboarding_completed_at";

  // postAuthPath / requireUser / getOwnProfile / sign-out route
  for (const u of [STUDENT, GOOGLE, ADMIN]) {
    await step(`role lookup ${u}`, u, "select role from public.administrator_roles where user_id = $1 and revoked_at is null", [u]);
    await step(`own profile ${u}`, u, "select id, first_name, surname, onboarding_completed_at, account_status from public.profiles where id = $1", [u]);
  }
  await step("sign-out route status", STUDENT, "select account_status from public.profiles where id = $1", [STUDENT]);

  // Onboarding
  await step("profile columns", STUDENT, `select ${PROFILE_COLUMNS} from public.profiles where id = $1`, [STUDENT]);
  await step("save personal", STUDENT, "update public.profiles set city = 'Maputo', phone = '+258841234567', onboarding_step = 2 where id = $1 returning city", [STUDENT]);
  const uem = (await db.query<{ id: string }>("select id from public.institutions where short_name = 'UEM'")).rows[0].id;
  const q = (await db.query<{ id: number }>("select id from public.qualification_types where code = 'bachelor'")).rows[0].id;
  const f = (await db.query<{ id: number }>("select id from public.fields_of_study where code = 'accounting_finance'")).rows[0].id;
  await step(
    "add education",
    STUDENT,
    `insert into public.education_records (profile_id, institution_id, institution_type, qualification_type_id, field_of_study_id, academic_status, year_of_study, start_year, end_year)
     values ($1, $2, 'university', $3, $4, 'enrolled', 3, 2023, 2027) returning institution_type, academic_status`,
    [STUDENT, uem, q, f],
  );
  const skills = (await db.query<{ id: number }>("select id from public.skill_catalogue order by id limit 3")).rows.map((r) => r.id);
  for (const s of skills) {
    await step(`add skill ${s}`, STUDENT, "insert into public.student_skills (profile_id, skill_id, proficiency) values ($1, $2, 'advanced') returning proficiency", [STUDENT, s]);
  }
  await step("save interests", STUDENT,
    "insert into public.professional_interests (profile_id, preferred_roles, availability) values ($1, '{Analyst}', 'immediately') on conflict (profile_id) do update set preferred_roles = excluded.preferred_roles returning preferred_roles", [STUDENT]);
  await step("add experience", STUDENT,
    "insert into public.experiences (profile_id, organisation, role_title, experience_type, start_date) values ($1, 'Org', 'Intern', 'internship', '2024-01-01') returning organisation", [STUDENT]);
  await step("upload object", STUDENT, "insert into storage.objects (bucket_id, name) values ('documents', $1) returning name", [`${STUDENT}/cv/cv.pdf`]);
  await step("record document", STUDENT,
    `insert into public.documents (profile_id, document_type, title, storage_path, original_filename, mime_type, size_bytes)
     values ($1, 'cv', 'CV', $2, 'cv.pdf', 'application/pdf', 1000) returning document_type`, [STUDENT, `${STUDENT}/cv/cv.pdf`]);
  await step("document count", STUDENT, "select count(*)::int n from public.documents where profile_id = $1", [STUDENT]);
  await step("complete onboarding", STUDENT, "update public.profiles set onboarding_completed_at = now() where id = $1 returning onboarding_completed_at is not null as done", [STUDENT]);
  await step("completion", STUDENT, "select public.profile_completion($1) as c", [STUDENT]);

  // Settings: employer visibility and consent history
  await step("visibility on", STUDENT, "select public.set_employer_visibility(true, '2026-11') as v");
  await step("visibility off", STUDENT, "select public.set_employer_visibility(false, '2026-11') as v");
  await step("consent history", STUDENT,
    "select consent_type, granted, version, source from public.consent_records where profile_id = $1 order by created_at desc, consent_type limit 50", [STUDENT]);
  await step("google consent history", GOOGLE,
    "select consent_type, granted, version, source from public.consent_records where profile_id = $1", [GOOGLE]);
  await step("marketing consent", STUDENT, "select public.record_consent('marketing', true, 'v1')");

  // Catalogues
  await step("catalogues", STUDENT, "select (select count(*) from public.provinces) p, (select count(*) from public.institutions) i, (select count(*) from public.skill_catalogue) s");

  // Administration
  await step("admin stats", ADMIN, "select public.admin_stats() as s");
  await step("admin search", ADMIN, "select id, completion, verification_status, account_status, total_count from public.admin_search_students() order by id");
  await step("admin view profile", ADMIN, "select account_status, verified_at from public.profiles where id = $1", [STUDENT]);
  await step("log view", ADMIN, "select public.log_admin_action('student.viewed', 'profiles', $1) > 0 as ok", [STUDENT]);
  await step("verify profile", ADMIN, "select public.admin_set_profile_verification($1, 'verified')", [STUDENT]);
  const edu = (await db.query<{ id: string }>("select id from public.education_records where profile_id = $1", [STUDENT])).rows[0].id;
  await step("reject record", ADMIN, "select public.admin_set_record_verification('education_records', $1, 'rejected', 'Upload the certificate')", [edu]);
  await step("student notifications", STUDENT, "select type, title, read_at from public.notifications order by type");
  await step("suspend", ADMIN, "select public.admin_set_account_status($1, 'suspended', 'Test')", [STUDENT]);
  await step("suspended status", STUDENT, "select account_status from public.profiles where id = $1", [STUDENT]);
  await step("suspended write", STUDENT, "update public.profiles set city = 'Beira' where id = $1 returning id", [STUDENT]);
  await step("suspended upload", STUDENT, "insert into storage.objects (bucket_id, name) values ('documents', $1) returning name", [`${STUDENT}/cv/x.pdf`]);
  await step("self suspend", ADMIN, "select public.admin_set_account_status($1, 'suspended', 'x')", [ADMIN]);
  await step("empty reason", ADMIN, "select public.admin_set_account_status($1, 'suspended', '')", [GOOGLE]);
  await step("unknown profile", ADMIN, "select public.admin_set_account_status($1, 'suspended', 'x')", ["00000000-0000-4000-8000-000000000999"]);
  await step("reactivate", ADMIN, "select public.admin_set_account_status($1, 'active', 'Cleared')", [STUDENT]);
  await step("write after reactivation", STUDENT, "update public.profiles set city = 'Beira' where id = $1 returning city", [STUDENT]);
  await step("grant role", SUPER, "select public.admin_set_role('gil@example.com', 'reviewer') is not null as ok");
  await step("team", SUPER, "select email, role from public.admin_list_team() order by email");
  await step("revoke role", SUPER, "select public.admin_set_role('gil@example.com', null) is not null as ok");
  await step("audit log", SUPER, "select action, target_table, target_id from public.admin_audit_log() order by id");
  await step("student cannot use admin", STUDENT, "select public.admin_stats()");
  await step("orphaned files", SUPER, "select count(*)::int n from public.admin_orphaned_files()");
  await step("anon profiles", null, "select * from public.profiles");
  return steps;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const TIMESTAMP = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:\d{2})?)?/g;

/** Generated identifiers and times differ between runs; everything else must match. */
function normalise(steps: Step[]) {
  return JSON.parse(
    JSON.stringify(steps, (_k, v) => (v instanceof Date ? "<time>" : v))
      .replace(UUID, (m) => (KNOWN.has(m) ? m : "<id>"))
      .replace(TIMESTAMP, "<time>"),
  );
}

let oldDb: PGlite;
let newDb: PGlite;
let before: Step[];
let after: Step[];

beforeAll(async () => {
  oldDb = await createDb({ upTo: BASELINE_LAST });
  newDb = await createDb();
  before = await journey(oldDb);
  after = await journey(newDb);
}, 120_000);

afterAll(async () => {
  await oldDb?.close();
  await newDb?.close();
});

describe("the application currently in production", () => {
  it("gets identical results before and after the Step 1 migrations", () => {
    expect(after.map((s) => s.name)).toEqual(before.map((s) => s.name));
    const b = normalise(before);
    const a = normalise(after);
    for (let i = 0; i < b.length; i++) expect(a[i], b[i].name).toEqual(b[i]);
  });

  it("the journey exercised real behaviour (sanity check)", () => {
    const find = (n: string) => before.find((s) => s.name === n)!.result;
    expect(find("suspended write")).toHaveProperty("error");
    expect(find("write after reactivation")).toEqual([{ city: "Beira" }]);
    expect((find("consent history") as unknown[]).length).toBe(4);
  });
});
