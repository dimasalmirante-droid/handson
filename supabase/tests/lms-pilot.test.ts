/**
 * Pilot course (migration 20261123000200): restricted, opened only by the
 * pilot code, and its quiz needs 7 of 8 to pass.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDb, expectDenied, signUp } from "./harness";

const SLUG = "preparacao-para-o-trabalho-piloto";
const QUIZ = "a1f0c0de-0000-4000-8000-000000000203";
const READING = "a1f0c0de-0000-4000-8000-000000000201";
const EXERCISE = "a1f0c0de-0000-4000-8000-000000000202";
const ANSWERS = [1, 2, 3, 0, 3, 0, 2, 3];

let db: PGlite;
let tester: string;
let other: string;

beforeAll(async () => {
  db = await createDb();
  tester = await signUp(db, { email: "piloto@example.com", meta: { first_name: "Piloto", surname: "Teste" } });
  other = await signUp(db, { email: "outro@example.com", meta: { first_name: "Outro", surname: "Aluno" } });
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("pilot course", () => {
  it("has one module with a reading, an exercise and an 8-question quiz", async () => {
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from public.quiz_questions where lesson_id = $1", [QUIZ]);
    expect(rows[0].n).toBe(8);
    const lessons = await db.query<{ lesson_type: string }>(
      "select l.lesson_type from public.course_lessons l join public.course_modules m on m.id = l.module_id join public.courses c on c.id = m.course_id where c.slug = $1 order by l.position",
      [SLUG],
    );
    expect(lessons.rows.map((r) => r.lesson_type)).toEqual(["text", "text", "quiz"]);
  });

  it("is invisible to students without the pilot code", async () => {
    const { rows } = await as(db, other, "select * from public.course_catalogue()");
    expect(rows).toHaveLength(0);
    const outline = await as<{ o: unknown }>(db, other, "select public.course_outline($1) o", [SLUG]);
    expect(outline.rows[0].o).toBeNull();
  });

  it("opens with the pilot code, in order, and needs 7 of 8 to pass", async () => {
    await as(db, tester, "select public.redeem_course_voucher('piloto-handson')");
    const { rows } = await as<{ slug: string; can_enter: boolean }>(db, tester, "select slug, can_enter from public.course_catalogue()");
    expect(rows).toEqual([{ slug: SLUG, can_enter: true }]);

    await as(db, tester, "select public.complete_lesson($1)", [READING]);
    await as(db, tester, "select public.complete_lesson($1)", [EXERCISE]);

    const sixRight = [...ANSWERS.slice(0, 6), (ANSWERS[6] + 1) % 4, (ANSWERS[7] + 1) % 4];
    const fail = await as<{ r: { score: number; passed: boolean } }>(db, tester, "select public.submit_quiz($1, $2::smallint[]) r", [QUIZ, sixRight]);
    expect(fail.rows[0].r).toMatchObject({ score: 75, passed: false });

    const pass = await as<{ r: { score: number; passed: boolean; course_completed: boolean } }>(
      db, tester, "select public.submit_quiz($1, $2::smallint[]) r", [QUIZ, ANSWERS],
    );
    expect(pass.rows[0].r).toMatchObject({ score: 100, passed: true, course_completed: true });
  });

  it("does not let another student into the course with someone else's progress", async () => {
    await expectDenied(db, other, "select public.complete_lesson($1)", [READING], /No access/);
  });
});
