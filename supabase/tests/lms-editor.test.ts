/**
 * Course editor (no migration): the admin course editor writes directly to the
 * content tables under Row Level Security. These tests confirm an administrator
 * can do every write the editor makes, and that reviewers and students cannot.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDb, makeAdmin, signUp } from "./harness";

let db: PGlite;
let admin: string;
let reviewer: string;
let student: string;

beforeAll(async () => {
  db = await createDb();
  admin = await signUp(db, { email: "admin@handson.cloud" });
  reviewer = await signUp(db, { email: "reviewer@handson.cloud" });
  student = await signUp(db, { email: "aluno@example.com", meta: { first_name: "Aluno", surname: "Teste" } });
  await makeAdmin(db, admin, "admin");
  await makeAdmin(db, reviewer, "reviewer");
}, 60_000);

afterAll(async () => {
  await db?.close();
});

const newCourse = (slug: string) =>
  `insert into public.courses (slug, title, status, audience, sequential, pass_mark, price_mzn, created_by)
   values ('${slug}', 'Curso ${slug}', 'draft', 'all_students', true, 80, 0, auth.uid()) returning id`;

describe("course editor writes", () => {
  it("lets an administrator build, reorder, publish and delete content", async () => {
    const { rows: c } = await as<{ id: string }>(db, admin, newCourse("curso-editor"));
    const course = c[0].id;

    const { rows: m } = await as<{ id: string }>(
      db, admin,
      "insert into public.course_modules (course_id, position, title) values ($1, 1, 'Um'), ($1, 2, 'Dois') returning id",
      [course],
    );
    const { rows: l } = await as<{ id: string }>(
      db, admin,
      `insert into public.course_lessons (module_id, position, title, lesson_type, body)
       values ($1, 1, 'Leitura', 'text', 'Texto'), ($1, 2, 'Teste', 'quiz', null) returning id`,
      [m[0].id],
    );

    // Swap the two lessons the way moveLesson does: park, move neighbour, settle.
    for (const [id, pos] of [[l[0].id, 30001], [l[1].id, 1], [l[0].id, 2]] as const) {
      await as(db, admin, "update public.course_lessons set position = $2 where id = $1", [id, pos]);
    }
    const { rows: order } = await as<{ title: string }>(db, admin, "select title from public.course_lessons where module_id = $1 order by position", [m[0].id]);
    expect(order.map((r) => r.title)).toEqual(["Teste", "Leitura"]);

    await as(
      db, admin,
      "insert into public.quiz_questions (lesson_id, position, prompt, options, correct_index) values ($1, 1, 'Pergunta?', array['a','b'], 1)",
      [l[1].id],
    );
    await as(db, admin, "update public.courses set status = 'published', published_at = now() where id = $1", [course]);
    await as(
      db, admin,
      "insert into public.course_vouchers (course_id, code, max_uses, created_by) values ($1, 'EDITOR-1', 5, auth.uid())",
      [course],
    );
    await as(db, admin, "select public.log_admin_action('course.update', 'courses', $1, '{}'::jsonb)", [course]);

    // The empty second module can be deleted.
    const { rows: deleted } = await as<{ id: string }>(db, admin, "delete from public.course_modules where id = $1 returning id", [m[1].id]);
    expect(deleted).toHaveLength(1);

    const { rows: seen } = await as<{ slug: string }>(db, student, "select slug from public.course_catalogue()");
    expect(seen.map((r) => r.slug)).toContain("curso-editor");
  });

  it("refuses every editor write from a reviewer or a student", async () => {
    const { rows: c } = await as<{ id: string }>(db, admin, newCourse("curso-protegido"));
    const course = c[0].id;
    const { rows: m } = await as<{ id: string }>(db, admin, "insert into public.course_modules (course_id, position, title) values ($1, 1, 'Um') returning id", [course]);

    for (const who of [reviewer, student]) {
      await expect(as(db, who, newCourse(`tentativa-${who.slice(-4)}`))).rejects.toThrow();
      await expect(as(db, who, "insert into public.course_modules (course_id, position, title) values ($1, 9, 'X')", [course])).rejects.toThrow();
      await expect(
        as(db, who, "insert into public.course_vouchers (course_id, code) values ($1, 'ROUBO-1')", [course]),
      ).rejects.toThrow();
      // Blocked updates and deletes match no rows rather than raising.
      const { rows: upd } = await as(db, who, "update public.courses set title = 'Alterado' where id = $1 returning id", [course]);
      expect(upd).toHaveLength(0);
      const { rows: del } = await as(db, who, "delete from public.course_modules where id = $1 returning id", [m[0].id]);
      expect(del).toHaveLength(0);
      const { rows: q } = await as(db, who, "select * from public.quiz_questions");
      if (who === student) expect(q).toHaveLength(0);
    }
    const { rows } = await db.query<{ title: string }>("select title from public.courses where id = $1", [course]);
    expect(rows[0].title).toBe("Curso curso-protegido");
  });

  it("still refuses a lesson without the content its type needs", async () => {
    const { rows: c } = await as<{ id: string }>(db, admin, newCourse("curso-validacao"));
    const { rows: m } = await as<{ id: string }>(db, admin, "insert into public.course_modules (course_id, position, title) values ($1, 1, 'Um') returning id", [c[0].id]);
    await expect(
      as(db, admin, "insert into public.course_lessons (module_id, position, title, lesson_type) values ($1, 1, 'Vídeo', 'video')", [m[0].id]),
    ).rejects.toThrow();
    await expect(
      as(db, admin, "insert into public.course_lessons (module_id, position, title, lesson_type, video_url) values ($1, 1, 'Vídeo', 'video', 'https://vimeo.com/1')", [m[0].id]),
    ).rejects.toThrow();
  });
});
