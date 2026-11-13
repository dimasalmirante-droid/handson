/**
 * Module 2 Step 1: accounts, workspaces, companies and invitations.
 *
 * Sign-up rules for email and Google registrations, account-level and
 * company-level suspension, invitation expiry, uniqueness and acceptance,
 * strict tenant isolation, and the security of every new database function.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDb, expectDenied, hasAccount, hasProfile, makeAdmin, newToken, signUp } from "./harness";

let db: PGlite;
let SUPER: string;
let ADMIN: string;
let REVIEWER: string;
let STUDENT: string;

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

async function createCompany(name: string, slug: string, note?: string) {
  const { rows } = await as<{ id: string }>(db, ADMIN, "select public.admin_create_company($1, $2, $3) as id", [name, slug, note ?? null]);
  return rows[0].id;
}

async function invite(company: string, email: string, role = "editor", expires = inDays(7)) {
  const t = newToken();
  const { rows } = await as<{ id: string }>(
    db,
    ADMIN,
    "select public.admin_create_invitation($1, $2, $3, $4, $5, $6, $7) as id",
    [company, email, role, "Invited Person", "HR Lead", t.hash, expires],
  );
  return { ...t, id: rows[0].id };
}

/** Make an invitation look as if it was created in the past and has now expired. */
async function expire(invitationId: string) {
  await db.query(
    "update public.company_invitations set created_at = now() - interval '10 days', expires_at = now() - interval '1 day' where id = $1",
    [invitationId],
  );
}

async function setCompanyStatus(company: string, status: string) {
  await db.query("update public.companies set status = $2 where id = $1", [company, status]);
}

async function contexts(id: string) {
  const { rows } = await as<{ c: { account_status: string; student: unknown; admin_role: string | null; companies: { id: string; role: string }[] } }>(
    db,
    id,
    "select public.my_contexts() as c",
  );
  return rows[0].c;
}

beforeAll(async () => {
  db = await createDb();
  SUPER = await signUp(db, { email: "super@handson.cloud" });
  ADMIN = await signUp(db, { email: "admin@handson.cloud" });
  REVIEWER = await signUp(db, { email: "reviewer@handson.cloud" });
  STUDENT = await signUp(db, { email: "student@example.com", meta: { first_name: "Ana", surname: "Cossa" } });
  await makeAdmin(db, SUPER, "super_admin");
  await makeAdmin(db, ADMIN, "admin");
  await makeAdmin(db, REVIEWER, "reviewer");
}, 60_000);

afterAll(async () => {
  await db?.close();
});

// ---------------------------------------------------------------------------
describe("sign-up: student profile rules (email and Google)", () => {
  let company: string;
  beforeAll(async () => {
    company = await createCompany("Signup Rules Lda", "signup-rules");
  });

  it("email registration without an invitation creates a student profile, as today", async () => {
    const id = await signUp(db, { email: "plain@example.com", meta: { first_name: "Lia", surname: "Muianga" } });
    expect(await hasProfile(db, id)).toBe(true);
    expect(await hasAccount(db, id)).toBe(true);
  });

  it("Google registration without an invitation creates a student profile with Google's names, as today", async () => {
    const id = await signUp(db, { email: "google.plain@example.com", provider: "google" });
    const { rows } = await db.query("select first_name, surname from public.profiles where id = $1", [id]);
    expect(rows[0]).toEqual({ first_name: "Google", surname: "Person" });
  });

  it("registration from the invitation page (no student marker) creates no student profile — email", async () => {
    await invite(company, "invitee.email@example.com");
    const id = await signUp(db, { email: "invitee.email@example.com", meta: { first_name: "Joao" } });
    expect(await hasProfile(db, id)).toBe(false);
    expect(await hasAccount(db, id)).toBe(true);
  });

  it("Google registration with a pending invitation creates no student profile", async () => {
    await invite(company, "invitee.google@example.com");
    const id = await signUp(db, { email: "invitee.google@example.com", provider: "google" });
    expect(await hasProfile(db, id)).toBe(false);
  });

  it("the student registration form still creates a profile when an invitation is pending", async () => {
    await invite(company, "both.roles@example.com");
    const id = await signUp(db, { email: "both.roles@example.com", meta: { first_name: "Nia", signup_intent: "student" } });
    expect(await hasProfile(db, id)).toBe(true);
  });

  it("the invitation email is matched regardless of case", async () => {
    await invite(company, "Mixed.Case@Example.com");
    const id = await signUp(db, { email: "MIXED.case@example.COM", provider: "google" });
    expect(await hasProfile(db, id)).toBe(false);
  });

  it("an expired, revoked or suspended-company invitation does not affect sign-up", async () => {
    const expired = await invite(company, "expired.signup@example.com");
    await expire(expired.id);
    const revoked = await invite(company, "revoked.signup@example.com");
    await db.query("update public.company_invitations set status = 'revoked', revoked_at = now() where id = $1", [revoked.id]);
    const other = await createCompany("Paused Lda", "paused-signup");
    await invite(other, "suspended.company@example.com");
    await setCompanyStatus(other, "suspended");

    for (const email of ["expired.signup@example.com", "revoked.signup@example.com", "suspended.company@example.com"]) {
      const id = await signUp(db, { email, provider: "google" });
      expect(await hasProfile(db, id)).toBe(true);
    }
  });

  it("legacy Terms metadata is still recorded, with or without a profile", async () => {
    await invite(company, "legacy.terms@example.com");
    const id = await signUp(db, { email: "legacy.terms@example.com", meta: { terms_version: "draft-2026-11" } });
    const { rows } = await db.query<{ consent_type: string; profile_id: string | null }>(
      "select consent_type, profile_id from public.consent_records where user_id = $1 order by consent_type",
      [id],
    );
    expect(rows).toEqual([
      { consent_type: "terms", profile_id: null },
      { consent_type: "privacy", profile_id: null },
    ]);
  });

  it("no company access is ever created at sign-up", async () => {
    const { rows } = await db.query(
      "select m.* from public.company_members m join auth.users u on u.id = m.user_id where u.email like 'invitee.%'",
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe("creating a student profile later", () => {
  let company: string;
  let person: string;
  let invitation: { hash: string };
  beforeAll(async () => {
    company = await createCompany("Later Profile Lda", "later-profile");
    invitation = await invite(company, "later@example.com");
    person = await signUp(db, { email: "later@example.com", provider: "google" });
  });

  it("works while an invitation is pending, and leaves the invitation untouched", async () => {
    expect(await hasProfile(db, person)).toBe(false);
    await as(db, person, "select public.create_student_profile()");
    expect(await hasProfile(db, person)).toBe(true);
    const inv = await db.query<{ status: string }>("select status from public.company_invitations where token_hash = $1", [invitation.hash]);
    expect(inv.rows[0].status).toBe("pending");
  });

  it("the invitation can still be accepted afterwards, giving both workspaces", async () => {
    await as(db, person, "select public.accept_invitation($1)", [invitation.hash]);
    const c = await contexts(person);
    expect(c.student).not.toBeNull();
    expect(c.companies.map((x) => x.id)).toEqual([company]);
  });

  it("cannot be done twice", async () => {
    await expectDenied(db, person, "select public.create_student_profile()", [], /already have a student profile/);
  });

  it("is refused for suspended accounts", async () => {
    const id = await signUp(db, { email: "suspended.later@example.com", provider: "google", meta: {} });
    await db.query("delete from public.profiles where id = $1", [id]);
    await as(db, ADMIN, "select public.admin_set_user_status($1, 'suspended', 'Test')", [id]);
    await expectDenied(db, id, "select public.create_student_profile()", [], /suspended/);
  });

  it("links earlier account-level consent to the new profile", async () => {
    const co = await createCompany("Consent Link Lda", "consent-link");
    await invite(co, "consent.link@example.com");
    const id = await signUp(db, { email: "consent.link@example.com", meta: { terms_version: "draft-2026-11" } });
    await as(db, id, "select public.create_student_profile()");
    const { rows } = await db.query<{ profile_id: string }>("select profile_id from public.consent_records where user_id = $1", [id]);
    expect(rows.every((r) => r.profile_id === id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("invitations: expiry, uniqueness and email case", () => {
  let company: string;
  beforeAll(async () => {
    company = await createCompany("Invite Rules Lda", "invite-rules");
  });

  it("a new invitation replaces one that has expired, which is marked expired", async () => {
    const first = await invite(company, "reinvite@example.com");
    await expire(first.id);
    const second = await invite(company, "reinvite@example.com");
    const { rows } = await db.query<{ id: string; status: string }>(
      "select id, status from public.company_invitations where company_id = $1 and email = 'reinvite@example.com' order by created_at",
      [company],
    );
    expect(rows).toEqual([
      { id: first.id, status: "expired" },
      { id: second.id, status: "pending" },
    ]);
    const audit = await db.query("select 1 from public.audit_logs where action = 'invitation.expired' and target_id = $1", [first.id]);
    expect(audit.rows).toHaveLength(1);
  });

  it("a second invitation while one is still valid is refused", async () => {
    await invite(company, "valid.once@example.com");
    await expectDenied(
      db,
      ADMIN,
      "select public.admin_create_invitation($1, 'valid.once@example.com', 'viewer', null, null, $2, $3)",
      [company, newToken().hash, inDays(7)],
      /already pending/,
    );
  });

  it("addresses differing only in case or spaces count as the same", async () => {
    await invite(company, "Ana@X.com");
    await expectDenied(
      db,
      ADMIN,
      "select public.admin_create_invitation($1, ' ana@x.com ', 'viewer', null, null, $2, $3)",
      [company, newToken().hash, inDays(7)],
      /already pending/,
    );
    const { rows } = await db.query<{ email: string }>("select email::text from public.company_invitations where company_id = $1 and email = 'ana@x.com'", [company]);
    expect(rows).toEqual([{ email: "ana@x.com" }]);
  });

  it("the database itself allows only one pending invitation per company and email", async () => {
    await expect(
      db.query(
        "insert into public.company_invitations (company_id, email, role, token_hash, expires_at) values ($1, 'ANA@x.com', 'viewer', $2, now() + interval '1 day')",
        [company, newToken().hash],
      ),
    ).rejects.toThrow(); // mixed case rejected by the check; lower case by the unique index
    await expect(
      db.query(
        "insert into public.company_invitations (company_id, email, role, token_hash, expires_at) values ($1, 'ana@x.com', 'viewer', $2, now() + interval '1 day')",
        [company, newToken().hash],
      ),
    ).rejects.toThrow();
  });

  it("a revoked invitation followed by a new one works", async () => {
    const first = await invite(company, "revoked.then@example.com");
    await db.query("update public.company_invitations set status = 'revoked' where id = $1", [first.id]);
    const second = await invite(company, "revoked.then@example.com");
    expect(second.id).not.toBe(first.id);
  });

  it("inviting someone who is already a member is refused; a removed member can be invited again", async () => {
    const inv = await invite(company, "member.again@example.com");
    const id = await signUp(db, { email: "member.again@example.com", provider: "google" });
    await as(db, id, "select public.accept_invitation($1)", [inv.hash]);
    await expectDenied(
      db,
      ADMIN,
      "select public.admin_create_invitation($1, 'Member.Again@example.com', 'viewer', null, null, $2, $3)",
      [company, newToken().hash, inDays(7)],
      /already a member/,
    );
    await db.query("delete from public.company_members where company_id = $1 and user_id = $2", [company, id]);
    await invite(company, "member.again@example.com");
  });

  it("an expired invitation stays expired after a newer one is accepted", async () => {
    const old = await invite(company, "old.and.new@example.com");
    await expire(old.id);
    const fresh = await invite(company, "old.and.new@example.com");
    const id = await signUp(db, { email: "old.and.new@example.com", provider: "google" });
    await expectDenied(db, id, "select public.accept_invitation($1)", [old.hash], /expired/);
    await as(db, id, "select public.accept_invitation($1)", [fresh.hash]);
    const { rows } = await db.query<{ status: string }>("select status from public.company_invitations where id = $1", [old.id]);
    expect(rows[0].status).toBe("expired");
  });

  it("rejects invalid input", async () => {
    const bad = [
      ["not-an-email", newToken().hash, inDays(7)],
      ["ok@example.com", "not-a-hash", inDays(7)],
      ["ok@example.com", newToken().hash, inDays(60)],
      ["ok@example.com", newToken().hash, new Date(Date.now() - 1000).toISOString()],
    ];
    for (const [email, hash, exp] of bad) {
      await expectDenied(db, ADMIN, "select public.admin_create_invitation($1, $2, 'viewer', null, null, $3, $4)", [company, email, hash, exp]);
    }
  });

  it("cannot invite into a suspended company", async () => {
    const co = await createCompany("Suspended Invite Lda", "suspended-invite");
    await setCompanyStatus(co, "suspended");
    await expectDenied(
      db,
      ADMIN,
      "select public.admin_create_invitation($1, 'x@example.com', 'viewer', null, null, $2, $3)",
      [co, newToken().hash, inDays(7)],
      /suspended/,
    );
  });
});

// ---------------------------------------------------------------------------
describe("accepting an invitation", () => {
  let company: string;
  beforeAll(async () => {
    company = await createCompany("Accept Checks Lda", "accept-checks");
  });

  it("succeeds with the right token and verified, matching email (any case); audited", async () => {
    const inv = await invite(company, "right.person@example.com", "company_admin");
    const id = await signUp(db, { email: "Right.Person@Example.com", provider: "google" });
    const { rows } = await as<{ c: string }>(db, id, "select public.accept_invitation($1) as c", [inv.hash]);
    expect(rows[0].c).toBe(company);
    const m = await db.query<{ role: string; full_name: string; job_title: string }>(
      "select role, full_name, job_title from public.company_members where user_id = $1",
      [id],
    );
    expect(m.rows[0]).toEqual({ role: "company_admin", full_name: "Invited Person", job_title: "HR Lead" });
    const audit = await db.query<{ company_id: string }>("select company_id from public.audit_logs where action = 'invitation.accepted' and actor_id = $1", [id]);
    expect(audit.rows).toEqual([{ company_id: company }]);
  });

  it("cannot be reused", async () => {
    const inv = await invite(company, "reuse@example.com");
    const id = await signUp(db, { email: "reuse@example.com", provider: "google" });
    await as(db, id, "select public.accept_invitation($1)", [inv.hash]);
    await expectDenied(db, id, "select public.accept_invitation($1)", [inv.hash], /already been used/);
    const other = await signUp(db, { email: "someone.else@example.com", provider: "google" });
    await expectDenied(db, other, "select public.accept_invitation($1)", [inv.hash], /already been used/);
  });

  it("is refused for a different email", async () => {
    const inv = await invite(company, "intended@example.com");
    const id = await signUp(db, { email: "intruder@example.com", provider: "google" });
    await expectDenied(db, id, "select public.accept_invitation($1)", [inv.hash], /different email/);
    const m = await db.query("select 1 from public.company_members where user_id = $1", [id]);
    expect(m.rows).toHaveLength(0);
  });

  it("is refused for an unverified email", async () => {
    const inv = await invite(company, "unverified@example.com");
    const id = await signUp(db, { email: "unverified@example.com", confirmed: false });
    await expectDenied(db, id, "select public.accept_invitation($1)", [inv.hash], /Verify your email/);
  });

  it("is refused when expired or revoked", async () => {
    const expired = await invite(company, "late@example.com");
    await expire(expired.id);
    const revoked = await invite(company, "withdrawn@example.com");
    await db.query("update public.company_invitations set status = 'revoked' where id = $1", [revoked.id]);
    const late = await signUp(db, { email: "late@example.com", provider: "google" });
    const withdrawn = await signUp(db, { email: "withdrawn@example.com", provider: "google" });
    await expectDenied(db, late, "select public.accept_invitation($1)", [expired.hash], /expired/);
    await expectDenied(db, withdrawn, "select public.accept_invitation($1)", [revoked.hash], /withdrawn/);
  });

  it("is refused for a suspended company or a suspended account", async () => {
    const co = await createCompany("Will Suspend Lda", "will-suspend");
    const inv = await invite(co, "co.suspended@example.com");
    await setCompanyStatus(co, "suspended");
    const a = await signUp(db, { email: "co.suspended@example.com", meta: { signup_intent: "student" } });
    await expectDenied(db, a, "select public.accept_invitation($1)", [inv.hash], /suspended/);

    const inv2 = await invite(company, "acct.suspended@example.com");
    const b = await signUp(db, { email: "acct.suspended@example.com", provider: "google" });
    await as(db, ADMIN, "select public.admin_set_user_status($1, 'suspended', 'Test')", [b]);
    await expectDenied(db, b, "select public.accept_invitation($1)", [inv2.hash], /suspended/);
  });

  it("needs the token: a signed-in invitee without it gets nothing", async () => {
    await invite(company, "no.token@example.com");
    const id = await signUp(db, { email: "no.token@example.com", provider: "google" });
    await expectDenied(db, id, "select public.accept_invitation($1)", [newToken().hash], /not found/);
    await expectDenied(db, id, "select public.accept_invitation('')", [], /not found/);
    await expectDenied(db, null, "select public.accept_invitation($1)", [newToken().hash]);
  });

  it("an existing student who accepts keeps their profile and records", async () => {
    const inv = await invite(company, "student@example.com", "viewer");
    await as(db, STUDENT, "update public.profiles set city = 'Maputo' where id = $1", [STUDENT]);
    await as(db, STUDENT, "select public.accept_invitation($1)", [inv.hash]);
    const p = await db.query<{ city: string }>("select city from public.profiles where id = $1", [STUDENT]);
    expect(p.rows[0].city).toBe("Maputo");
    const c = await contexts(STUDENT);
    expect(c.student).not.toBeNull();
    expect(c.companies.map((x) => x.id)).toContain(company);
  });

  it("the preview shows only company, role and a masked email, and never the token hash", async () => {
    const inv = await invite(company, "preview.me@example.com", "editor");
    const { rows } = await as(db, null, "select * from public.invitation_preview($1)", [inv.hash]);
    expect(rows).toEqual([
      expect.objectContaining({ company_name: "Accept Checks Lda", role: "editor", email_hint: "p•••@example.com", status: "pending" }),
    ]);
    expect(Object.keys(rows[0] as object)).not.toContain("token_hash");
    const none = await as(db, null, "select * from public.invitation_preview($1)", [newToken().hash]);
    expect(none.rows).toHaveLength(0);
  });

  it("my_pending_invitations lists only the caller's own valid invitations", async () => {
    const co = await createCompany("Pending List Lda", "pending-list");
    await invite(co, "pending.list@example.com", "viewer");
    await invite(co, "someone.different@example.com", "viewer");
    const id = await signUp(db, { email: "pending.list@example.com", provider: "google" });
    const { rows } = await as<{ company_name: string; role: string }>(db, id, "select company_name, role from public.my_pending_invitations()");
    expect(rows).toEqual([{ company_name: "Pending List Lda", role: "viewer" }]);
    const unverified = await signUp(db, { email: "someone.different@example.com", confirmed: false });
    const none = await as(db, unverified, "select * from public.my_pending_invitations()");
    expect(none.rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe("workspaces (my_contexts)", () => {
  it("reports student, employer and admin workspaces in every combination", async () => {
    const co = await createCompany("Context Lda", "context-lda");
    const onlyEmployerInv = await invite(co, "only.employer@example.com");
    const onlyEmployer = await signUp(db, { email: "only.employer@example.com", provider: "google" });
    await as(db, onlyEmployer, "select public.accept_invitation($1)", [onlyEmployerInv.hash]);

    const adminStudentEmployerInv = await invite(co, "admin@handson.cloud", "viewer");
    await as(db, ADMIN, "select public.accept_invitation($1)", [adminStudentEmployerInv.hash]);

    const s = await contexts(STUDENT);
    expect(s.admin_role).toBeNull();
    expect(s.student).toEqual({ onboarding_completed: false });

    const e = await contexts(onlyEmployer);
    expect(e).toMatchObject({ account_status: "active", student: null, admin_role: null });
    expect(e.companies).toEqual([expect.objectContaining({ id: co, name: "Context Lda", role: "editor", status: "onboarding" })]);

    const a = await contexts(ADMIN);
    expect(a.admin_role).toBe("admin");
    expect(a.student).not.toBeNull();
    expect(a.companies.map((x) => x.id)).toContain(co);
  });

  it("is refused to anonymous visitors", async () => {
    await expectDenied(db, null, "select public.my_contexts()");
  });
});

// ---------------------------------------------------------------------------
describe("tenant isolation", () => {
  let coA: string;
  let coB: string;
  let memberA: string;
  let adminA: string;
  let viewerA: string;

  beforeAll(async () => {
    coA = await createCompany("Alpha Lda", "alpha", "Internal: priority account");
    coB = await createCompany("Beta Lda", "beta", "Internal: watch contract");
    const add = async (co: string, email: string, role: string) => {
      const inv = await invite(co, email, role);
      const id = await signUp(db, { email, provider: "google" });
      await as(db, id, "select public.accept_invitation($1)", [inv.hash]);
      return id;
    };
    memberA = await add(coA, "editor.a@alpha.co.mz", "editor");
    adminA = await add(coA, "admin.a@alpha.co.mz", "company_admin");
    viewerA = await add(coA, "viewer.a@alpha.co.mz", "viewer");
    await add(coB, "editor.b@beta.co.mz", "editor");
    await invite(coA, "pending.a@example.com", "viewer");
    await invite(coB, "pending.b@example.com", "viewer");
  });

  it("members see only their own company", async () => {
    const { rows } = await as<{ id: string }>(db, memberA, "select id from public.companies");
    expect(rows.map((r) => r.id)).toEqual([coA]);
  });

  it("members see only their own colleagues", async () => {
    const { rows } = await as<{ company_id: string }>(db, memberA, "select distinct company_id from public.company_members");
    expect(rows.map((r) => r.company_id)).toEqual([coA]);
  });

  it("company members never see internal notes", async () => {
    for (const id of [memberA, adminA, viewerA]) {
      const { rows } = await as(db, id, "select * from public.company_admin_notes");
      expect(rows).toHaveLength(0);
    }
  });

  it("only company admins see their own company's invitations, without token hashes", async () => {
    const own = await as<{ company_id: string }>(db, adminA, "select distinct company_id from public.company_invitations");
    expect(own.rows.map((r) => r.company_id)).toEqual([coA]);
    await expectDenied(db, adminA, "select token_hash from public.company_invitations");
    for (const id of [memberA, viewerA]) {
      const { rows } = await as(db, id, "select id from public.company_invitations");
      expect(rows).toHaveLength(0);
    }
  });

  it("students and anonymous visitors see nothing", async () => {
    const student = await signUp(db, { email: "isolated.student@example.com" });
    for (const t of ["companies", "company_members", "company_admin_notes"]) {
      const { rows } = await as(db, student, `select * from public.${t}`);
      expect(rows).toHaveLength(0);
      await expectDenied(db, null, `select * from public.${t}`);
    }
    await expectDenied(db, null, "select id from public.company_invitations");
  });

  it("nobody can write to company tables directly in Step 1", async () => {
    await expectDenied(db, adminA, "update public.companies set name = 'Hacked' where id = $1", [coA]);
    await expectDenied(db, adminA, "insert into public.company_members (company_id, user_id, role) values ($1, $2, 'company_admin')", [coB, adminA]);
    await expectDenied(db, adminA, "update public.company_members set role = 'company_admin' where user_id = $1", [memberA]);
    await expectDenied(db, adminA, "insert into public.company_admin_notes (company_id, body) values ($1, 'x')", [coA]);
    await expectDenied(db, ADMIN, "delete from public.companies where id = $1", [coB]);
  });

  it("Handson administrators can read companies, members, notes and invitations", async () => {
    const notes = await as(db, REVIEWER, "select body from public.company_admin_notes where company_id = $1", [coA]);
    expect(notes.rows).toEqual([{ body: "Internal: priority account" }]);
    const cos = await as<{ n: number }>(db, REVIEWER, "select count(*)::int n from public.companies where id in ($1, $2)", [coA, coB]);
    expect(cos.rows[0].n).toBe(2);
  });

  it("company helpers answer only about the caller", async () => {
    const yes = await as<{ ok: boolean }>(db, memberA, "select public.is_company_member($1) ok", [coA]);
    const no = await as<{ ok: boolean }>(db, memberA, "select public.is_company_member($1) ok", [coB]);
    expect([yes.rows[0].ok, no.rows[0].ok]).toEqual([true, false]);
    const role = await as<{ ok: boolean }>(db, memberA, "select public.has_company_role($1, 'company_admin') ok", [coA]);
    expect(role.rows[0].ok).toBe(false);
  });

  it("a suspended company blocks its members without affecting their other workspaces", async () => {
    const both = await signUp(db, { email: "two.companies@example.com", meta: { signup_intent: "student" } });
    for (const co of [coA, coB]) {
      const inv = await invite(co, "two.companies@example.com", "viewer");
      await as(db, both, "select public.accept_invitation($1)", [inv.hash]);
    }
    await setCompanyStatus(coB, "suspended");
    const members = await as<{ company_id: string }>(db, both, "select distinct company_id from public.company_members");
    expect(members.rows.map((r) => r.company_id)).toEqual([coA]);
    const company = await as<{ id: string; status: string }>(db, both, "select id, status from public.companies order by name");
    expect(company.rows).toEqual([{ id: coA, status: "onboarding" }, { id: coB, status: "suspended" }]); // the notice can be shown
    const writable = await as<{ ok: boolean }>(db, both, "select public.company_is_writable($1) ok", [coB]);
    expect(writable.rows[0].ok).toBe(false);
    const c = await contexts(both);
    expect(c.student).not.toBeNull();
    await setCompanyStatus(coB, "active");
  });

  it("onboarding and active companies are writable", async () => {
    await setCompanyStatus(coA, "onboarding");
    const a = await as<{ ok: boolean }>(db, memberA, "select public.company_is_writable($1) ok", [coA]);
    await setCompanyStatus(coA, "active");
    const b = await as<{ ok: boolean }>(db, memberA, "select public.company_is_writable($1) ok", [coA]);
    expect([a.rows[0].ok, b.rows[0].ok]).toEqual([true, true]);
  });
});

// ---------------------------------------------------------------------------
describe("account-level suspension", () => {
  let co: string;
  let employerOnly: string;

  beforeAll(async () => {
    co = await createCompany("Suspension Lda", "suspension-lda");
    const inv = await invite(co, "employer.only@example.com", "company_admin");
    employerOnly = await signUp(db, { email: "employer.only@example.com", provider: "google" });
    await as(db, employerOnly, "select public.accept_invitation($1)", [inv.hash]);
  });

  it("an account without a student profile can be suspended and loses all company access", async () => {
    expect(await hasProfile(db, employerOnly)).toBe(false);
    await as(db, ADMIN, "select public.admin_set_user_status($1, 'suspended', 'Policy breach')", [employerOnly]);
    const cos = await as(db, employerOnly, "select * from public.companies");
    expect(cos.rows).toHaveLength(0);
    const inv = await as(db, employerOnly, "select id from public.company_invitations");
    expect(inv.rows).toHaveLength(0);
    const c = await contexts(employerOnly);
    expect(c).toMatchObject({ account_status: "suspended", companies: [] });
    const audit = await db.query<{ target_table: string }>(
      "select target_table from public.audit_logs where action = 'account.suspended' and target_id = $1",
      [employerOnly],
    );
    expect(audit.rows).toEqual([{ target_table: "accounts" }]);
    await as(db, ADMIN, "select public.admin_set_user_status($1, 'active', 'Cleared')", [employerOnly]);
    const back = await as(db, employerOnly, "select * from public.companies");
    expect(back.rows).toHaveLength(1);
  });

  it("student suspension behaves exactly as before and the profile mirror stays in sync", async () => {
    const s = await signUp(db, { email: "mirror@example.com" });
    await as(db, ADMIN, "select public.admin_set_account_status($1, 'suspended', 'Test')", [s]);
    const p = await db.query<{ account_status: string }>("select account_status from public.profiles where id = $1", [s]);
    const a = await db.query<{ status: string }>("select status from public.accounts where user_id = $1", [s]);
    expect([p.rows[0].account_status, a.rows[0].status]).toEqual(["suspended", "suspended"]);
    await expectDenied(db, s, "update public.profiles set city = 'Beira' where id = $1 returning id", [s]);
    await as(db, ADMIN, "select public.admin_set_account_status($1, 'active', 'Cleared')", [s]);
    const ok = await as(db, s, "update public.profiles set city = 'Beira' where id = $1 returning id", [s]);
    expect(ok.rows).toHaveLength(1);
  });

  it("the profile mirror cannot be changed on its own", async () => {
    await expect(db.query("update public.profiles set account_status = 'suspended' where id = $1", [STUDENT])).rejects.toThrow(/managed on the account/);
  });

  it("a suspended administrator loses administrator rights in the database", async () => {
    const extra = await signUp(db, { email: "extra.admin@handson.cloud" });
    await makeAdmin(db, extra, "admin");
    await as(db, SUPER, "select public.admin_set_user_status($1, 'suspended', 'Left the team')", [extra]);
    const r = await as<{ ok: boolean }>(db, extra, "select public.is_admin() ok");
    expect(r.rows[0].ok).toBe(false);
    await expectDenied(db, extra, "select * from public.admin_search_students()");
  });

  it("only a super admin can suspend an administrator; nobody can suspend themselves", async () => {
    await expectDenied(db, ADMIN, "select public.admin_set_user_status($1, 'suspended', 'x')", [REVIEWER], /super administrator/);
    await expectDenied(db, ADMIN, "select public.admin_set_user_status($1, 'suspended', 'x')", [ADMIN], /your own/);
    await expectDenied(db, REVIEWER, "select public.admin_set_user_status($1, 'suspended', 'x')", [STUDENT]);
    await expectDenied(db, STUDENT, "select public.admin_set_user_status($1, 'suspended', 'x')", [employerOnly]);
  });

  it("there is always at least one active super admin", async () => {
    const second = await signUp(db, { email: "second.super@handson.cloud" });
    await makeAdmin(db, second, "super_admin");
    await as(db, second, "select public.admin_set_user_status($1, 'suspended', 'Rotation')", [SUPER]);
    // The suspended super admin can no longer act, and the remaining one cannot suspend themselves.
    await expectDenied(db, SUPER, "select public.admin_set_user_status($1, 'suspended', 'x')", [second], /Not authorised/);
    await expectDenied(db, second, "select public.admin_set_user_status($1, 'suspended', 'x')", [second], /your own/);
    await as(db, second, "select public.admin_set_user_status($1, 'active', 'Back')", [SUPER]);
    const r = await as<{ ok: boolean }>(db, SUPER, "select public.has_admin_role('super_admin') ok");
    expect(r.rows[0].ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("administration functions", () => {
  it("only Handson admins and above can create companies and invitations", async () => {
    await expectDenied(db, REVIEWER, "select public.admin_create_company('X Lda', 'x-lda')", [], /Not authorised/);
    await expectDenied(db, STUDENT, "select public.admin_create_company('X Lda', 'x-lda')", [], /Not authorised/);
    await expectDenied(db, null, "select public.admin_create_company('X Lda', 'x-lda')");
    const co = await createCompany("Gamma Lda", "gamma");
    await expectDenied(
      db,
      REVIEWER,
      "select public.admin_create_invitation($1, 'a@b.co', 'viewer', null, null, $2, $3)",
      [co, newToken().hash, inDays(7)],
      /Not authorised/,
    );
  });

  it("validates company details and keeps web addresses unique", async () => {
    await expectDenied(db, ADMIN, "select public.admin_create_company('Delta', 'Delta Lda!')", [], /web address/);
    await createCompany("Delta Lda", "delta");
    await expectDenied(db, ADMIN, "select public.admin_create_company('Delta Two', 'delta')", [], /already used/);
  });

  it("records every action in the audit log with the company", async () => {
    const co = await createCompany("Epsilon Lda", "epsilon");
    const inv = await invite(co, "audit.me@example.com");
    const { rows } = await db.query<{ action: string; company_id: string }>(
      "select action, company_id from public.audit_logs where company_id = $1 order by id",
      [co],
    );
    expect(rows.map((r) => r.action)).toEqual(["company.created", "invitation.created"]);
    const meta = await db.query<{ metadata: Record<string, unknown> }>("select metadata from public.audit_logs where target_id = $1", [inv.id]);
    expect(JSON.stringify(meta.rows)).not.toContain(inv.hash);
  });
});

// ---------------------------------------------------------------------------
describe("database function security", () => {
  const STEP1_FUNCTIONS = [
    "consent_records_sync_ids", "legal_documents_guard", "current_legal_documents", "legal_acceptance_status",
    "accept_legal_documents", "admin_save_legal_draft", "admin_publish_legal_document", "admin_delete_legal_draft",
    "handle_new_account", "accounts_mirror_status", "profiles_account_status_guard", "person_is_active",
    "admin_set_user_status", "is_company_member", "has_company_role", "company_is_writable", "my_contexts",
    "my_pending_invitations", "create_student_profile", "invitation_preview", "accept_invitation",
    "admin_create_company", "admin_create_invitation",
    // existing functions changed in Step 1
    "handle_new_user", "set_employer_visibility", "record_consent", "has_admin_role", "admin_set_account_status",
  ];

  it("every Step 1 function has a fixed, empty search_path", async () => {
    const { rows } = await db.query<{ proname: string; proconfig: string[] | null }>(
      "select proname, proconfig from pg_proc where pronamespace = 'public'::regnamespace and proname = any($1)",
      [STEP1_FUNCTIONS],
    );
    expect(new Set(rows.map((r) => r.proname))).toEqual(new Set(STEP1_FUNCTIONS));
    for (const r of rows) expect(r.proconfig ?? [], r.proname).toContain('search_path=""');
  });

  it("anonymous visitors can run only the invitation preview and the current legal documents", async () => {
    const { rows } = await db.query<{ proname: string }>(
      "select proname from pg_proc where pronamespace = 'public'::regnamespace and proname = any($1) and has_function_privilege('anon', oid, 'execute') order by 1",
      [STEP1_FUNCTIONS],
    );
    expect(rows.map((r) => r.proname)).toEqual(["current_legal_documents", "invitation_preview"]);
  });

  it("trigger and internal functions cannot be called by signed-in users", async () => {
    const internal = ["consent_records_sync_ids", "legal_documents_guard", "handle_new_account", "accounts_mirror_status", "profiles_account_status_guard", "handle_new_user"];
    const { rows } = await db.query<{ proname: string }>(
      "select proname from pg_proc where pronamespace = 'public'::regnamespace and proname = any($1) and has_function_privilege('authenticated', oid, 'execute')",
      [internal],
    );
    expect(rows).toEqual([]);
  });

  it("new tables have Row Level Security on and no direct write grants", async () => {
    const tables = ["accounts", "legal_documents", "companies", "company_admin_notes", "company_members", "company_invitations"];
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname = any($1)",
      [tables],
    );
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
    for (const t of tables) {
      for (const role of ["anon", "authenticated"]) {
        const { rows: p } = await db.query<{ w: boolean }>(
          `select has_table_privilege($1, $2, 'INSERT') or has_table_privilege($1, $2, 'UPDATE') or has_table_privilege($1, $2, 'DELETE') as w`,
          [role, `public.${t}`],
        );
        expect(p[0].w, `${role} on ${t}`).toBe(false);
      }
    }
  });
});
