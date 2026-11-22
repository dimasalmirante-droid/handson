/**
 * Learning (LMS) foundation (migration 20261123000100): catalogue visibility,
 * access by price and audience, prerequisites, sequential modules, server-side
 * quiz grading, completions, vouchers and administrator grants.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDb, expectDenied, makeAdmin, signUp } from "./harness";

let db: PGlite;
let amina: string;
let bento: string;
let carla: string;
let admin: string;
let reviewer: string;

let freeCourse: string;
let paidCourse: string;
let draftCourse: string;
let restrictedCourse: string;
let advancedCourse: string;

let freeM1: string;
let freeM2: string;
let freeVideo: string;
let freeQuiz: string;
let freeM2Text: string;
let paidPreview: string;
let paidLocked: string;

async function course(slug: string, opts: { status?: string; price?: number; audience?: string; sequential?: boolean } = {}) {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.courses (slug, title, status, published_at, price_mzn, audience, sequential, badge_name)
     values ($1, $1, $2::public.course_status, case when $2 = 'draft' then null else now() end, $3, $4::public.course_audience, $5, 'Badge')
     returning id`,
    [slug, opts.status ?? "published", opts.price ?? 0, opts.audience ?? "all_students", opts.sequential ?? false],
  );
  return rows[0].id;
}

async function moduleOf(courseId: string, position: number) {
  const { rows } = await db.query<{ id: string }>(
    "insert into public.course_modules (course_id, position, title) values ($1, $2, $3) returning id",
    [courseId, position, `Módulo ${position}`],
  );
  return rows[0].id;
}

async function lesson(moduleId: string, position: number, type: string, extra: { preview?: boolean } = {}) {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.course_lessons (module_id, position, title, lesson_type, video_url, body, is_preview)
     values ($1, $2, $3, $4::public.lesson_type,
             case when $4 = 'video' then 'https://www.youtube.com/watch?v=abc' end,
             case when $4 in ('text', 'video') then 'Resumo' end, $5)
     returning id`,
    [moduleId, position, `Lição ${position}`, type, extra.preview ?? false],
  );
  return rows[0].id;
}

async function questions(lessonId: string, correct: number[]) {
  for (const [i, c] of correct.entries()) {
    await db.query(
      "insert into public.quiz_questions (lesson_id, position, prompt, options, correct_index, explanation) values ($1, $2, $3, $4, $5, 'Porque sim')",
      [lessonId, i + 1, `Pergunta ${i + 1}`, ["a", "b", "c"], c],
    );
  }
}

beforeAll(async () => {
  db = await createDb();
  amina = await signUp(db, { email: "amina@example.com", meta: { first_name: "Amina", surname: "Macuácua" } });
  bento = await signUp(db, { email: "bento@example.com", meta: { first_name: "Bento", surname: "Sitoe" } });
  carla = await signUp(db, { email: "carla@example.com", meta: { first_name: "Carla", surname: "Nhantumbo" } });
  admin = await signUp(db, { email: "admin@handson.cloud" });
  reviewer = await signUp(db, { email: "reviewer@handson.cloud" });
  await makeAdmin(db, admin, "admin");
  await makeAdmin(db, reviewer, "reviewer");

  freeCourse = await course("preparacao-para-o-trabalho", { sequential: true });
  freeM1 = await moduleOf(freeCourse, 1);
  freeVideo = await lesson(freeM1, 1, "video");
  freeQuiz = await lesson(freeM1, 2, "quiz");
  await questions(freeQuiz, [1, 0, 2, 1]);
  freeM2 = await moduleOf(freeCourse, 2);
  freeM2Text = await lesson(freeM2, 1, "text");

  paidCourse = await course("excel-avancado", { price: 500 });
  const pm = await moduleOf(paidCourse, 1);
  paidPreview = await lesson(pm, 1, "text", { preview: true });
  paidLocked = await lesson(pm, 2, "text");

  draftCourse = await course("rascunho", { status: "draft" });
  await lesson(await moduleOf(draftCourse, 1), 1, "text");

  restrictedCourse = await course("integracao-empresa-x", { audience: "restricted" });
  await lesson(await moduleOf(restrictedCourse, 1), 1, "text");

  advancedCourse = await course("entrevista-avancada");
  await lesson(await moduleOf(advancedCourse, 1), 1, "text");
  await db.query("insert into public.course_prerequisites (course_id, requires_course_id) values ($1, $2)", [advancedCourse, freeCourse]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("catalogue and visibility", () => {
  it("shows published courses for all students, never drafts or restricted courses without access", async () => {
    const { rows } = await as<{ slug: string }>(db, amina, "select slug from public.course_catalogue()");
    const slugs = rows.map((r) => r.slug).sort();
    expect(slugs).toEqual(["entrevista-avancada", "excel-avancado", "preparacao-para-o-trabalho"]);

    const direct = await as<{ slug: string }>(db, amina, "select slug from public.courses");
    expect(direct.rows.map((r) => r.slug)).not.toContain("rascunho");
    expect(direct.rows.map((r) => r.slug)).not.toContain("integracao-empresa-x");
  });

  it("is not available to anonymous visitors", async () => {
    await expectDenied(db, null, "select * from public.course_catalogue()");
    await expectDenied(db, null, "select * from public.courses");
  });

  it("marks paid courses as not enterable and free courses as enterable", async () => {
    const { rows } = await as<{ slug: string; can_enter: boolean; price_mzn: number }>(
      db, amina, "select slug, can_enter, price_mzn from public.course_catalogue()",
    );
    const bySlug = Object.fromEntries(rows.map((r) => [r.slug, r]));
    expect(bySlug["preparacao-para-o-trabalho"].can_enter).toBe(true);
    expect(bySlug["excel-avancado"]).toMatchObject({ can_enter: false, price_mzn: 500 });
    expect(bySlug["entrevista-avancada"].can_enter).toBe(false);
  });

  it("returns an outline for visible courses only", async () => {
    const ok = await as<{ o: { modules: unknown[]; can_enter: boolean } }>(db, amina, "select public.course_outline('preparacao-para-o-trabalho') o");
    expect(ok.rows[0].o.modules).toHaveLength(2);
    const draft = await as<{ o: unknown }>(db, amina, "select public.course_outline('rascunho') o");
    expect(draft.rows[0].o).toBeNull();
  });
});

describe("lesson content", () => {
  it("is readable in a free course", async () => {
    const { rows } = await as(db, amina, "select id from public.course_lessons where id = $1", [freeVideo]);
    expect(rows).toHaveLength(1);
  });

  it("is hidden in a paid course without access, except the preview lesson", async () => {
    const { rows } = await as<{ id: string }>(db, amina, "select id from public.course_lessons where id in ($1, $2)", [paidPreview, paidLocked]);
    expect(rows.map((r) => r.id)).toEqual([paidPreview]);
  });

  it("never exposes correct quiz answers to students", async () => {
    const direct = await as(db, amina, "select * from public.quiz_questions where lesson_id = $1", [freeQuiz]);
    expect(direct.rows).toHaveLength(0);
    const viaFn = await as<Record<string, unknown>>(db, amina, "select * from public.quiz_for_lesson($1)", [freeQuiz]);
    expect(viaFn.rows).toHaveLength(4);
    expect(Object.keys(viaFn.rows[0]).sort()).toEqual(["id", "options", "prompt", "question_position"]);
  });

  it("does not return quiz questions for a lesson the student cannot open", async () => {
    const { rows: pq } = await db.query<{ id: string }>(
      "insert into public.course_lessons (module_id, position, title, lesson_type) select module_id, 3, 'Quiz', 'quiz' from public.course_lessons where id = $1 returning id",
      [paidLocked],
    );
    await questions(pq[0].id, [0, 1]);
    const { rows } = await as(db, amina, "select * from public.quiz_for_lesson($1)", [pq[0].id]);
    expect(rows).toHaveLength(0);
    await db.query("delete from public.course_lessons where id = $1", [pq[0].id]);
  });
});

describe("progress, quizzes and completion", () => {
  it("students cannot write progress, access or completions directly", async () => {
    await expectDenied(db, amina, "insert into public.lesson_progress (user_id, lesson_id, completed_at) values ($1, $2, now())", [amina, freeVideo]);
    await expectDenied(db, amina, "insert into public.course_access (user_id, course_id, source, course_version) values ($1, $2, 'admin_grant', 1)", [amina, paidCourse]);
    await expectDenied(db, amina, "insert into public.course_completions (user_id, course_id, course_version) values ($1, $2, 1)", [amina, freeCourse]);
    const upd = await as(db, amina, "update public.courses set price_mzn = 0 where id = $1", [paidCourse]);
    expect(upd.affectedRows).toBe(0);
    const { rows } = await db.query<{ price_mzn: number }>("select price_mzn from public.courses where id = $1", [paidCourse]);
    expect(rows[0].price_mzn).toBe(500);
  });

  it("completes a video lesson but refuses to complete a quiz without passing it", async () => {
    await as(db, amina, "select public.complete_lesson($1)", [freeVideo]);
    await expectDenied(db, amina, "select public.complete_lesson($1)", [freeQuiz], /passing/);
  });

  it("keeps the next module closed in a sequential course until the previous one is complete", async () => {
    await expectDenied(db, amina, "select public.complete_lesson($1)", [freeM2Text], /previous modules/);
  });

  it("grades a quiz on the server: 2 of 4 fails, 3 of 4 passes at the 75% mark", async () => {
    const fail = await as<{ r: { score: number; passed: boolean; questions: { correct: boolean }[] } }>(
      db, amina, "select public.submit_quiz($1, $2::smallint[]) r", [freeQuiz, [1, 0, 0, 0]],
    );
    expect(fail.rows[0].r).toMatchObject({ score: 50, passed: false });
    expect(fail.rows[0].r.questions.map((q) => q.correct)).toEqual([true, true, false, false]);

    const pass = await as<{ r: { score: number; passed: boolean; course_completed: boolean } }>(
      db, amina, "select public.submit_quiz($1, $2::smallint[]) r", [freeQuiz, [1, 0, 2, 0]],
    );
    expect(pass.rows[0].r).toMatchObject({ score: 75, passed: true, course_completed: false });

    const { rows } = await as<{ attempts: number; best_score: number }>(
      db, amina, "select attempts, best_score from public.lesson_progress where lesson_id = $1", [freeQuiz],
    );
    expect(rows[0]).toEqual({ attempts: 2, best_score: 75 });
  });

  it("rejects incomplete answers", async () => {
    await expectDenied(db, amina, "select public.submit_quiz($1, $2::smallint[])", [freeQuiz, [1, 0]], /Answer every question/);
  });

  it("records the completion (the badge) once every lesson is complete", async () => {
    const { rows } = await as<{ done: boolean }>(db, amina, "select public.complete_lesson($1) done", [freeM2Text]);
    expect(rows[0].done).toBe(true);
    const c = await as<{ course_version: number }>(db, amina, "select course_version from public.course_completions where course_id = $1", [freeCourse]);
    expect(c.rows).toEqual([{ course_version: 1 }]);
  });

  it("opens a course whose prerequisite is now complete", async () => {
    const { rows } = await as<{ can_enter: boolean }>(db, amina, "select can_enter from public.course_catalogue() where slug = 'entrevista-avancada'");
    expect(rows[0].can_enter).toBe(true);
  });

  it("keeps each student's progress private", async () => {
    const { rows } = await as(db, bento, "select * from public.lesson_progress");
    expect(rows).toHaveLength(0);
    const c = await as(db, bento, "select * from public.course_completions");
    expect(c.rows).toHaveLength(0);
    const adminView = await as(db, reviewer, "select * from public.course_completions");
    expect(adminView.rows.length).toBeGreaterThan(0);
  });
});

describe("paid courses: access grants and vouchers", () => {
  it("refuses progress in a paid course without access", async () => {
    await expectDenied(db, bento, "select public.complete_lesson($1)", [paidLocked], /No access/);
  });

  it("only administrators (admin role) can grant access, and the grant is audited", async () => {
    await expectDenied(db, bento, "select public.admin_grant_course_access($1, $2, 'purchase', 500)", [bento, paidCourse]);
    await expectDenied(db, reviewer, "select public.admin_grant_course_access($1, $2, 'purchase', 500)", [bento, paidCourse]);

    await as(db, admin, "select public.admin_grant_course_access($1, $2, 'purchase', 500, null, 'M-Pesa ref 123')", [bento, paidCourse]);
    const { rows } = await as<{ id: string }>(db, bento, "select id from public.course_lessons where id = $1", [paidLocked]);
    expect(rows).toHaveLength(1);
    await as(db, bento, "select public.complete_lesson($1)", [paidLocked]);

    const audit = await db.query("select 1 from public.audit_logs where action = 'course_access.grant'");
    expect(audit.rows).toHaveLength(1);
  });

  it("revoking access closes the lessons again", async () => {
    const { rows: acc } = await db.query<{ id: string }>("select id from public.course_access where user_id = $1 and course_id = $2", [bento, paidCourse]);
    await as(db, admin, "select public.admin_revoke_course_access($1, 'Reembolso')", [acc[0].id]);
    const { rows } = await as(db, bento, "select id from public.course_lessons where id = $1", [paidLocked]);
    expect(rows).toHaveLength(0);
  });

  it("a voucher opens a course once per student and respects its use limit", async () => {
    await db.query("insert into public.course_vouchers (course_id, code, max_uses, sponsor_name) values ($1, 'UEM-2026', 1, 'UEM')", [paidCourse]);
    const r = await as<{ c: string }>(db, carla, "select public.redeem_course_voucher(' uem-2026 ') c");
    expect(r.rows[0].c).toBe(paidCourse);
    const { rows } = await as<{ source: string; sponsor_name: string }>(db, carla, "select source, sponsor_name from public.course_access");
    expect(rows).toEqual([{ source: "voucher", sponsor_name: "UEM" }]);
    await expectDenied(db, amina, "select public.redeem_course_voucher('UEM-2026')", [], /not valid/);
    await expectDenied(db, amina, "select public.redeem_course_voucher('NAO-EXISTE')", [], /not valid/);
  });

  it("students cannot read vouchers or other students' access", async () => {
    const v = await as(db, amina, "select * from public.course_vouchers");
    expect(v.rows).toHaveLength(0);
    const a = await as<{ user_id: string }>(db, amina, "select user_id from public.course_access");
    expect(a.rows.every((r) => r.user_id === amina)).toBe(true);
  });
});

describe("restricted courses and suspended accounts", () => {
  it("a restricted course appears only for students with a grant", async () => {
    await as(db, admin, "select public.admin_grant_course_access($1, $2, 'sponsor', 0, 'Empresa X')", [carla, restrictedCourse]);
    const carlaView = await as<{ slug: string }>(db, carla, "select slug from public.course_catalogue()");
    expect(carlaView.rows.map((r) => r.slug)).toContain("integracao-empresa-x");
    const aminaView = await as<{ slug: string }>(db, amina, "select slug from public.course_catalogue()");
    expect(aminaView.rows.map((r) => r.slug)).not.toContain("integracao-empresa-x");
  });

  it("a suspended account sees no courses and cannot progress", async () => {
    await db.query("update public.accounts set status = 'suspended' where user_id = $1", [bento]);
    await db.query("update public.profiles set account_status = 'suspended' where id = $1", [bento]);
    const { rows } = await as(db, bento, "select * from public.course_catalogue()");
    expect(rows).toHaveLength(0);
    await expectDenied(db, bento, "select public.complete_lesson($1)", [freeVideo], /No access/);
  });

  it("only admins can change course content", async () => {
    await expectDenied(db, reviewer, "insert into public.courses (slug, title) values ('novo-curso', 'Novo')");
    await as(db, admin, "insert into public.courses (slug, title) values ('novo-curso', 'Novo')");
    const { rows } = await as(db, admin, "select 1 from public.courses where slug = 'novo-curso'");
    expect(rows).toHaveLength(1);
  });
});
