/**
 * Completed courses on the public profile (migration 20261125000100): shown
 * only when the student chooses the 'courses' section.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDb, signUp } from "./harness";

const READING = "a1f0c0de-0000-4000-8000-000000000201";
const EXERCISE = "a1f0c0de-0000-4000-8000-000000000202";
const QUIZ = "a1f0c0de-0000-4000-8000-000000000203";

let db: PGlite;
let lina: string;

type Public = { courses?: { title: string; badge_name: string; completed_at: string }[] };

beforeAll(async () => {
  db = await createDb();
  lina = await signUp(db, { email: "lina@example.com", meta: { first_name: "Lina", surname: "Cossa" } });
  await as(db, lina, "select public.redeem_course_voucher('PILOTO-HANDSON')");
  await as(db, lina, "select public.complete_lesson($1)", [READING]);
  await as(db, lina, "select public.complete_lesson($1)", [EXERCISE]);
  await as(db, lina, "select public.submit_quiz($1, $2::smallint[])", [QUIZ, [1, 2, 3, 0, 3, 0, 2, 3]]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("completed courses on the public profile", () => {
  it("are hidden unless the student chooses the section", async () => {
    await as(db, lina, "select public.set_public_profile(true, 'lina-cossa', array['headline'])");
    const { rows } = await as<{ p: Public }>(db, null, "select public.public_profile('lina-cossa') p");
    expect(rows[0].p.courses).toBeUndefined();
  });

  it("are shown with title, badge and date when chosen", async () => {
    await as(db, lina, "select public.set_public_profile(true, 'lina-cossa', array['headline', 'courses'])");
    const { rows } = await as<{ p: Public }>(db, null, "select public.public_profile('lina-cossa') p");
    expect(rows[0].p.courses).toHaveLength(1);
    expect(rows[0].p.courses![0]).toMatchObject({
      title: "Preparação para o Trabalho (piloto)",
      badge_name: "Preparação para o Trabalho · Módulo 1",
    });
  });

  it("ignore unknown section names", async () => {
    await as(db, lina, "select public.set_public_profile(true, 'lina-cossa', array['courses', 'phone'])");
    const { rows } = await db.query<{ public_sections: string[] }>("select public_sections from public.profiles where id = $1", [lina]);
    expect(rows[0].public_sections).toEqual(["courses"]);
  });
});
