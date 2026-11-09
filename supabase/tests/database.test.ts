/**
 * Database tests: apply every migration to an in-memory Postgres (PGlite)
 * with stand-ins for Supabase's auth schema and roles, then check Row Level
 * Security, column protections, consent, the audit log and profile completion.
 *
 * Run with: npm run test:db
 */
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS = join(__dirname, "..", "migrations");

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create schema extensions;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    email_confirmed_at timestamptz,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth, extensions to anon, authenticated;

  create schema storage;
  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner uuid default auth.uid(),
    metadata jsonb,
    unique (bucket_id, name)
  );
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, delete on storage.objects to authenticated;
`;

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ADMIN = "00000000-0000-4000-8000-0000000000ad";

let db: PGlite;

/** Run statements as a given user (or anonymous when uid is null). */
async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  await db.exec(`set role ${uid ? "authenticated" : "anon"};`);
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}

async function expectDenied(uid: string | null, sql: string, params: unknown[] = []) {
  await expect(as(uid, sql, params)).rejects.toThrow();
}

beforeAll(async () => {
  db = new PGlite({ extensions: { citext, pg_trgm } });
  await db.exec(SUPABASE_STUBS);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  await db.exec(`
    insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
      ('${A}', 'amina@example.com', now(), '{"first_name":"Amina","surname":"Macuácua","terms_version":"draft-2026-11"}'),
      ('${B}', 'bento@example.com', now(), '{"given_name":"Bento","family_name":"Sitoe"}'),
      ('${ADMIN}', 'admin@handson.cloud', now(), '{}');
    insert into public.administrator_roles (user_id, role) values ('${ADMIN}', 'admin');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("sign-up trigger", () => {
  it("creates profiles with names from email or Google metadata", async () => {
    const { rows } = await db.query<{ id: string; first_name: string; surname: string }>(
      "select id, first_name, surname from public.profiles order by email",
    );
    expect(rows.find((r) => r.id === A)).toMatchObject({ first_name: "Amina", surname: "Macuácua" });
    expect(rows.find((r) => r.id === B)).toMatchObject({ first_name: "Bento", surname: "Sitoe" });
  });

  it("records terms and privacy consent when accepted at sign-up", async () => {
    const { rows } = await db.query("select consent_type from public.consent_records where profile_id = $1 order by 1", [A]);
    expect(rows.map((r) => (r as { consent_type: string }).consent_type).sort()).toEqual(["privacy", "terms"]);
  });

  it("new profiles are private and unverified by default", async () => {
    const { rows } = await db.query<{ employer_visibility: boolean; verification_status: string }>(
      "select employer_visibility, verification_status from public.profiles where id = $1",
      [A],
    );
    expect(rows[0]).toEqual({ employer_visibility: false, verification_status: "unverified" });
  });
});

describe("reference catalogues", () => {
  it("are seeded", async () => {
    const counts = await db.query<{ t: string; n: number }>(`
      select 'provinces' t, count(*)::int n from public.provinces union all
      select 'institutions', count(*)::int from public.institutions union all
      select 'qualifications', count(*)::int from public.qualification_types union all
      select 'fields', count(*)::int from public.fields_of_study union all
      select 'skills', count(*)::int from public.skill_catalogue union all
      select 'industries', count(*)::int from public.industries union all
      select 'functions', count(*)::int from public.job_functions`);
    const byName = Object.fromEntries(counts.rows.map((r) => [r.t, r.n]));
    expect(byName.provinces).toBe(11);
    for (const n of Object.values(byName)) expect(n).toBeGreaterThan(0);
  });

  it("are readable by signed-in users but not anonymous visitors", async () => {
    const { rows } = await as(A, "select count(*)::int n from public.provinces");
    expect((rows[0] as { n: number }).n).toBe(11);
    await expectDenied(null, "select * from public.provinces");
  });

  it("cannot be changed by students", async () => {
    await expectDenied(A, "insert into public.industries (code, name_en, name_pt) values ('x', 'X', 'X')");
    const { rows } = await as(A, "update public.provinces set name_en = 'Hacked' returning id");
    expect(rows).toHaveLength(0);
  });
});

describe("student data isolation (RLS)", () => {
  let qualificationId: number;
  let fieldId: number;
  let institutionId: string;

  beforeAll(async () => {
    qualificationId = (await db.query<{ id: number }>("select id from public.qualification_types where code = 'bachelor'")).rows[0].id;
    fieldId = (await db.query<{ id: number }>("select id from public.fields_of_study where code = 'accounting_finance'")).rows[0].id;
    institutionId = (await db.query<{ id: string }>("select id from public.institutions where short_name = 'UEM'")).rows[0].id;
  });

  it("lets a student create and read their own education record", async () => {
    await as(A, `insert into public.education_records
      (profile_id, institution_id, institution_type, qualification_type_id, field_of_study_id, academic_status, year_of_study, start_year, end_year)
      values ($1, $2, 'university', $3, $4, 'enrolled', 4, 2023, 2027)`, [A, institutionId, qualificationId, fieldId]);
    const { rows } = await as(A, "select profile_id from public.education_records");
    expect(rows).toEqual([{ profile_id: A }]);
  });

  it("hides one student's records from another", async () => {
    const { rows } = await as(B, "select * from public.education_records");
    expect(rows).toHaveLength(0);
    const profiles = await as(B, "select id from public.profiles");
    expect(profiles.rows).toEqual([{ id: B }]);
  });

  it("prevents creating records for another student", async () => {
    await expectDenied(B, `insert into public.experiences (profile_id, organisation, role_title, experience_type, start_date)
      values ($1, 'Org', 'Role', 'internship', '2024-01-01')`, [A]);
  });

  it("prevents changing or deleting another student's records", async () => {
    const upd = await as(B, "update public.education_records set year_of_study = 1 returning id");
    expect(upd.rows).toHaveLength(0);
    const del = await as(B, "delete from public.education_records returning id");
    expect(del.rows).toHaveLength(0);
    const { rows } = await db.query("select count(*)::int n from public.education_records where profile_id = $1", [A]);
    expect((rows[0] as { n: number }).n).toBe(1);
  });

  it("gives anonymous visitors no access", async () => {
    await expectDenied(null, "select * from public.profiles");
    await expectDenied(null, "select * from public.education_records");
  });
});

describe("protected fields", () => {
  it("students cannot verify their own records or profile", async () => {
    await expectDenied(A, "update public.education_records set verification_status = 'verified'");
    await expectDenied(A, "update public.profiles set verification_status = 'verified' where id = $1", [A]);
    await expectDenied(A, "update public.profiles set account_status = 'active' where id = $1", [A]);
  });

  it("students cannot switch on employer visibility directly", async () => {
    await expectDenied(A, "update public.profiles set employer_visibility = true where id = $1", [A]);
  });

  it("students can update their personal fields", async () => {
    const { rows } = await as(A, "update public.profiles set city = 'Maputo', phone = '+258841234567' where id = $1 returning city", [A]);
    expect(rows).toEqual([{ city: "Maputo" }]);
  });

  it("rejects invalid data at the database level", async () => {
    await expect(as(A, "update public.profiles set phone = '841234567' where id = $1", [A])).rejects.toThrow();
    await expect(as(A, "update public.profiles set linkedin_url = 'http://evil.example' where id = $1", [A])).rejects.toThrow();
  });

  it("students cannot grant themselves an administrator role", async () => {
    await expectDenied(A, "insert into public.administrator_roles (user_id, role) values ($1, 'super_admin')", [A]);
    const { rows } = await as(A, "select public.is_admin() as admin");
    expect(rows).toEqual([{ admin: false }]);
  });

  it("students cannot write to or read the audit log", async () => {
    await expectDenied(A, "insert into public.audit_logs (action) values ('fake.action')");
    await expectDenied(A, "select public.log_admin_action('fake.action')");
    const { rows } = await as(A, "select * from public.audit_logs");
    expect(rows).toHaveLength(0);
  });

  it("document paths must sit in the owner's folder", async () => {
    await expect(
      as(A, `insert into public.documents (profile_id, document_type, title, storage_path, original_filename, mime_type, size_bytes)
        values ($1, 'cv', 'CV', $2, 'cv.pdf', 'application/pdf', 1000)`, [A, `${B}/cv.pdf`]),
    ).rejects.toThrow();
  });
});

describe("consent", () => {
  it("records each change and updates visibility", async () => {
    await as(A, "select public.set_employer_visibility(true)");
    await as(A, "select public.set_employer_visibility(false)");
    await as(A, "select public.set_employer_visibility(true)");
    const history = await as(A, "select granted from public.consent_records where consent_type = 'employer_visibility' order by created_at, id");
    expect(history.rows).toHaveLength(3);
    const { rows } = await db.query<{ employer_visibility: boolean }>("select employer_visibility from public.profiles where id = $1", [A]);
    expect(rows[0].employer_visibility).toBe(true);
  });

  it("consent history cannot be altered by students", async () => {
    await expectDenied(A, "delete from public.consent_records");
    await expectDenied(A, "update public.consent_records set granted = false");
  });
});

describe("administrators", () => {
  it("can read all students' data", async () => {
    const { rows } = await as(ADMIN, "select count(*)::int n from public.profiles");
    expect((rows[0] as { n: number }).n).toBe(3);
    const edu = await as(ADMIN, "select count(*)::int n from public.education_records");
    expect((edu.rows[0] as { n: number }).n).toBe(1);
  });

  it("can log actions, and role changes are audited automatically", async () => {
    await as(ADMIN, "select public.log_admin_action('student.viewed', 'profiles', $1)", [A]);
    const { rows } = await db.query<{ action: string }>("select action from public.audit_logs order by id");
    expect(rows.map((r) => r.action)).toEqual(["admin_role.insert", "student.viewed"]);
  });

  it("only super admins can read the audit log", async () => {
    const { rows } = await as(ADMIN, "select * from public.audit_logs");
    expect(rows).toHaveLength(0);
  });

  it("cannot edit audit entries", async () => {
    await expectDenied(ADMIN, "delete from public.audit_logs");
  });
});

describe("profile completion", () => {
  it("scores sections from saved data", async () => {
    const { rows } = await as<{ c: { total: number; sections: Record<string, { score: number; missing: string[] }> } }>(
      A,
      "select public.profile_completion() as c",
    );
    const c = rows[0].c;
    // Personal: first name, surname, city, phone filled = 4 of 7 → 15 × 4/7 = 8.57
    expect(c.sections.personal.score).toBeCloseTo(8.57, 2);
    expect(c.sections.personal.missing).toEqual(["date_of_birth", "nationality", "province"]);
    expect(c.sections.education.score).toBe(20);
    expect(c.sections.skills.score).toBe(0);
    expect(c.sections.documents.missing).toEqual(["cv", "transcript"]);
    expect(c.total).toBe(Math.round(8.57 + 20));
  });

  it("gives partial skills credit and full credit at three skills", async () => {
    const ids = (await db.query<{ id: number }>("select id from public.skill_catalogue order by id limit 3")).rows.map((r) => r.id);
    await as(A, "insert into public.student_skills (profile_id, skill_id, proficiency) values ($1, $2, 'advanced')", [A, ids[0]]);
    let c = (await as<{ c: { sections: { skills: { score: number } } } }>(A, "select public.profile_completion() as c")).rows[0].c;
    expect(c.sections.skills.score).toBe(5);
    await as(A, "insert into public.student_skills (profile_id, skill_id, proficiency) values ($1, $2, 'beginner'), ($1, $3, 'expert')", [A, ids[1], ids[2]]);
    c = (await as<{ c: { sections: { skills: { score: number } } } }>(A, "select public.profile_completion() as c")).rows[0].c;
    expect(c.sections.skills.score).toBe(15);
  });

  it("a student cannot see another student's score", async () => {
    const { rows } = await as(B, "select public.profile_completion($1) as c", [A]);
    expect((rows[0] as { c: unknown }).c).toBeNull();
  });

  it("an administrator can see any student's score", async () => {
    const { rows } = await as<{ c: { total: number } }>(ADMIN, "select public.profile_completion($1) as c", [A]);
    expect(rows[0].c.total).toBeGreaterThan(0);
  });
});

describe("integrity", () => {
  it("editing a verified record resets it for review", async () => {
    await db.exec("update public.education_records set verification_status = 'verified'");
    await as(A, "update public.education_records set year_of_study = 4");
    const { rows } = await db.query<{ verification_status: string }>("select verification_status from public.education_records");
    expect(rows[0].verification_status).toBe("unverified");
  });

  it("limits how many records a student can create", async () => {
    const q = (await db.query<{ id: number }>("select id from public.qualification_types where code = 'other'")).rows[0].id;
    const insert = () =>
      as(B, `insert into public.education_records
        (profile_id, institution_name_other, institution_type, qualification_type_id, field_of_study_other, academic_status, start_year)
        values ($1, 'Escola', 'other', $2, 'Geral', 'enrolled', 2020)`, [B, q]);
    for (let i = 0; i < 10; i++) await insert();
    await expect(insert()).rejects.toThrow(/Limit reached/);
  });
});

describe("file storage", () => {
  it("creates private buckets with size limits", async () => {
    const { rows } = await db.query<{ id: string; public: boolean; file_size_limit: number }>(
      "select id, public, file_size_limit::int from storage.buckets order by id",
    );
    expect(rows).toEqual([
      { id: "avatars", public: false, file_size_limit: 2097152 },
      { id: "documents", public: false, file_size_limit: 10485760 },
    ]);
  });

  it("lets students upload only into their own folder", async () => {
    await as(A, "insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${A}/cv/file.pdf`]);
    await expectDenied(A, "insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${B}/cv/file.pdf`]);
    await expectDenied(A, "insert into storage.objects (bucket_id, name) values ('documents', 'loose-file.pdf')");
  });

  it("hides one student's files from another", async () => {
    const mine = await as(A, "select name from storage.objects");
    expect(mine.rows).toHaveLength(1);
    const theirs = await as(B, "select name from storage.objects");
    expect(theirs.rows).toHaveLength(0);
    const del = await as(B, "delete from storage.objects returning id");
    expect(del.rows).toHaveLength(0);
  });

  it("gives anonymous visitors no access to files", async () => {
    await expectDenied(null, "select * from storage.objects");
  });

  it("lets administrators read files for verification", async () => {
    const { rows } = await as(ADMIN, "select name from storage.objects");
    expect(rows).toHaveLength(1);
  });

  it("requires profile photos to sit in the owner's folder", async () => {
    await expect(as(A, "update public.profiles set photo_path = $1 where id = $2", [`${B}/avatar.png`, A])).rejects.toThrow();
    const ok = await as(A, "update public.profiles set photo_path = $1 where id = $2 returning photo_path", [`${A}/avatar.png`, A]);
    expect(ok.rows).toHaveLength(1);
  });
});

describe("administration", () => {
  const SUPER = "00000000-0000-4000-8000-0000000000ff";
  const REVIEWER = "00000000-0000-4000-8000-0000000000ee";

  beforeAll(async () => {
    await db.exec(`
      insert into auth.users (id, email, email_confirmed_at) values
        ('${SUPER}', 'super@handson.cloud', now()),
        ('${REVIEWER}', 'reviewer@handson.cloud', now());
      insert into public.administrator_roles (user_id, role) values ('${SUPER}', 'super_admin'), ('${REVIEWER}', 'reviewer');
    `);
  });

  it("search returns students only, with filters and a total count", async () => {
    const all = await as<{ id: string; total_count: number; completion: number }>(REVIEWER, "select * from public.admin_search_students()");
    const ids = all.rows.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([A, B]));
    expect(ids).not.toContain(ADMIN);
    expect(Number(all.rows[0].total_count)).toBe(all.rows.length);

    const byName = await as<{ id: string }>(REVIEWER, "select id from public.admin_search_students(p_query => 'amina')");
    expect(byName.rows.map((r) => r.id)).toEqual([A]);

    const uem = (await db.query<{ id: string }>("select id from public.institutions where short_name = 'UEM'")).rows[0].id;
    const byInstitution = await as<{ id: string }>(REVIEWER, "select id from public.admin_search_students(p_institution => $1)", [uem]);
    expect(byInstitution.rows.map((r) => r.id)).toEqual([A]);

    const highCompletion = await as<{ id: string }>(REVIEWER, "select id from public.admin_search_students(p_min_completion => 40)");
    expect(highCompletion.rows.map((r) => r.id)).toEqual([A]);
  });

  it("students cannot search or read statistics", async () => {
    await expectDenied(A, "select * from public.admin_search_students()");
    await expectDenied(A, "select public.admin_stats()");
  });

  it("statistics count students", async () => {
    const { rows } = await as<{ s: { total: number } }>(REVIEWER, "select public.admin_stats() as s");
    expect(Number(rows[0].s.total)).toBe(2);
  });

  it("reviewers verify profiles and records; students are notified and actions audited", async () => {
    await as(REVIEWER, "select public.admin_set_profile_verification($1, 'verified')", [A]);
    const edu = (await db.query<{ id: string }>("select id from public.education_records where profile_id = $1", [A])).rows[0].id;
    await as(REVIEWER, "select public.admin_set_record_verification('education_records', $1, 'rejected', 'Please upload the certificate.')", [edu]);

    const p = await db.query<{ verification_status: string; verified_by: string }>("select verification_status, verified_by from public.profiles where id = $1", [A]);
    expect(p.rows[0]).toEqual({ verification_status: "verified", verified_by: REVIEWER });

    const notes = await as<{ type: string }>(A, "select type from public.notifications order by created_at, type");
    expect(notes.rows.map((r) => r.type).sort()).toEqual(["profile.verified", "qualification.rejected"]);

    const audit = await db.query<{ action: string }>("select action from public.audit_logs where actor_id = $1 order by id", [REVIEWER]);
    expect(audit.rows.map((r) => r.action)).toEqual(["profile.verification_set", "qualification.verification_set"]);
  });

  it("students cannot verify, even through the admin functions", async () => {
    await expectDenied(A, "select public.admin_set_profile_verification($1, 'verified')", [A]);
  });

  it("only admins and above can suspend; suspended students cannot change data", async () => {
    await expectDenied(REVIEWER, "select public.admin_set_account_status($1, 'suspended', 'Test')", [B]);
    await expectDenied(ADMIN, "select public.admin_set_account_status($1, 'suspended', '')", [B]);
    await as(ADMIN, "select public.admin_set_account_status($1, 'suspended', 'Fraudulent documents')", [B]);

    await expectDenied(B, "update public.profiles set city = 'Beira' where id = $1 returning id", [B]);
    await expectDenied(B, "insert into public.experiences (profile_id, organisation, role_title, experience_type, start_date) values ($1, 'Org', 'Role', 'internship', '2024-01-01')", [B]);
    await expectDenied(B, "insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${B}/cv/x.pdf`]);
    const read = await as(B, "select id from public.profiles");
    expect(read.rows).toHaveLength(1);

    await as(ADMIN, "select public.admin_set_account_status($1, 'active', 'Reviewed and cleared')", [B]);
    const ok = await as(B, "update public.profiles set city = 'Beira' where id = $1 returning id", [B]);
    expect(ok.rows).toHaveLength(1);
  });

  it("only super admins manage administrators and read the audit log", async () => {
    await expectDenied(ADMIN, "select public.admin_set_role('bento@example.com', 'reviewer')");
    await expectDenied(ADMIN, "select * from public.admin_audit_log()");

    await as(SUPER, "select public.admin_set_role('bento@example.com', 'reviewer')");
    let team = await as<{ email: string; role: string }>(SUPER, "select email, role from public.admin_list_team()");
    expect(team.rows).toEqual(expect.arrayContaining([{ email: "bento@example.com", role: "reviewer" }]));

    await as(SUPER, "select public.admin_set_role('bento@example.com', null)");
    team = await as<{ email: string; role: string }>(SUPER, "select email, role from public.admin_list_team()");
    expect(team.rows.map((r) => r.email)).not.toContain("bento@example.com");

    await expectDenied(SUPER, "select public.admin_set_role('super@handson.cloud', null)");
    await expectDenied(SUPER, "select public.admin_set_role('nobody@example.com', 'admin')");

    const log = await as<{ action: string; actor_email: string | null }>(SUPER, "select action, actor_email from public.admin_audit_log() limit 50");
    expect(log.rows.map((r) => r.action)).toEqual(expect.arrayContaining(["admin_role.update", "account.suspended", "account.reactivated"]));
  });
});
