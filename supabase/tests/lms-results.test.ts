/**
 * Learning results (migration 20261123000300): quiz attempts are recorded by
 * submit_quiz(), are private per student, and administrators see aggregates.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDb, expectDenied, makeAdmin, signUp } from "./harness";

const COURSE = "a1f0c0de-0000-4000-8000-000000000001";
const READING = "a1f0c0de-0000-4000-8000-000000000201";
const EXERCISE = "a1f0c0de-0000-4000-8000-000000000202";
const QUIZ = "a1f0c0de-0000-4000-8000-000000000203";
const RIGHT = [1, 2, 3, 0, 3, 0, 2, 3];

let db: PGlite;
let ana: string;
let rui: string;
let reviewer: string;

type Results = {
  started: number;
  completed: number;
  lessons: { id: string; started: number; completed: number; quiz: null | { attempts: number; students: number; average_score: number; first_attempt_pass_rate: number; questions: { position: number; missed_pct: number }[] } }[];
};

beforeAll(async () => {
  db = await createDb();
  ana = await signUp(db, { email: "ana@example.com", meta: { first_name: "Ana", surname: "Mondlane" } });
  rui = await signUp(db, { email: "rui@example.com", meta: { first_name: "Rui", surname: "Tembe" } });
  reviewer = await signUp(db, { email: "reviewer@handson.cloud" });
  await makeAdmin(db, reviewer, "reviewer");
  for (const s of [ana, rui]) {
    await as(db, s, "select public.redeem_course_voucher('PILOTO-HANDSON')");
    await as(db, s, "select public.complete_lesson($1)", [READING]);
  }
  await as(db, ana, "select public.complete_lesson($1)", [EXERCISE]);
  // Ana: fails once (questions 1 and 2 wrong), then passes.
  await as(db, ana, "select public.submit_quiz($1, $2::smallint[])", [QUIZ, [0, 0, ...RIGHT.slice(2)]]);
  await as(db, ana, "select public.submit_quiz($1, $2::smallint[])", [QUIZ, RIGHT]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("quiz attempts", () => {
  it("are recorded for every submission with per-question correctness", async () => {
    const { rows } = await as<{ score: number; passed: boolean; correct: boolean[] }>(
      db, ana, "select score, passed, correct from public.quiz_attempts order by created_at",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ score: 75, passed: false });
    expect(rows[0].correct.slice(0, 3)).toEqual([false, false, true]);
    expect(rows[1]).toMatchObject({ score: 100, passed: true });
  });

  it("are private to each student and cannot be written directly", async () => {
    const { rows } = await as(db, rui, "select * from public.quiz_attempts");
    expect(rows).toHaveLength(0);
    await expectDenied(
      db, rui,
      "insert into public.quiz_attempts (user_id, lesson_id, answers, correct, score, passed) values ($1, $2, '{1}', '{true}', 100, true)",
      [rui, QUIZ],
    );
  });
});

describe("administrator results", () => {
  it("are refused to students", async () => {
    await expectDenied(db, ana, "select * from public.admin_learning_overview()", [], /Not authorised/);
    await expectDenied(db, ana, "select public.admin_course_results($1)", [COURSE], /Not authorised/);
  });

  it("summarise each course for administrators", async () => {
    const { rows } = await as<{ slug: string; started: number; completed: number; with_access: number; lessons: number }>(
      db, reviewer, "select slug, started, completed, with_access, lessons from public.admin_learning_overview()",
    );
    expect(rows).toContainEqual({ slug: "preparacao-para-o-trabalho-piloto", started: 2, completed: 1, with_access: 2, lessons: 3 });
  });

  it("show where students stop and which questions they miss, without naming anyone", async () => {
    const { rows } = await as<{ r: Results }>(db, reviewer, "select public.admin_course_results($1) r", [COURSE]);
    const r = rows[0].r;
    expect(r).toMatchObject({ started: 2, completed: 1 });
    const [reading, exercise, quiz] = r.lessons;
    expect(reading).toMatchObject({ started: 2, completed: 2 });
    expect(exercise).toMatchObject({ started: 1, completed: 1 });
    expect(quiz.quiz).toMatchObject({ attempts: 2, students: 1, average_score: 88, first_attempt_pass_rate: 0 });
    expect(quiz.quiz!.questions.slice(0, 3).map((q) => q.missed_pct)).toEqual([50, 50, 0]);
    expect(JSON.stringify(r)).not.toContain(ana);
    expect(JSON.stringify(r)).not.toContain("Ana");
  });
});
