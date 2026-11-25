"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { courseSchema, grantSchema, lessonSchema, moduleSchema, publishProblems, quizSchema, voucherSchema, type EditorLessonType } from "@/lib/learning/editor";
import { createClient } from "@/lib/supabase/server";

/**
 * Course editor actions. Every action requires the admin role (checked here and
 * again by Row Level Security), validates its input, and writes an audit entry.
 * Deleting anything students have progress on is refused: archive instead.
 */

export type EditorResult = { ok: boolean; message: string; fields?: Record<string, string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");
const bad = (message: string): EditorResult => ({ ok: false, message });

type Supabase = Awaited<ReturnType<typeof createClient>>;

function issues(error: { issues: { path: PropertyKey[]; message: string }[] }): EditorResult {
  const fields: Record<string, string> = {};
  for (const i of error.issues) fields[String(i.path[0] ?? "form")] ??= i.message;
  return { ok: false, message: error.issues[0]?.message ?? "Check the highlighted fields.", fields };
}

function failed(error: { code?: string; message: string }, fallback: string): EditorResult {
  if (error.code === "23505") return bad("That address or code is already in use. Choose another.");
  if (error.code === "42501") return bad("You do not have permission to do this.");
  console.error("course editor action failed", error.code, error.message);
  return bad(fallback);
}

async function audit(supabase: Supabase, action: string, table: string, id: string, metadata: Record<string, unknown> = {}) {
  const { error } = await supabase.rpc("log_admin_action", { p_action: action, p_target_table: table, p_target_id: id, p_metadata: metadata });
  if (error) console.error("audit log failed", action, error.code, error.message);
}

function refresh(courseId?: string) {
  revalidatePath("/admin/learning", "layout");
  revalidatePath("/dashboard", "layout");
  if (courseId) revalidatePath(`/admin/learning/${courseId}`, "layout");
}

async function courseOfModule(supabase: Supabase, moduleId: string) {
  const { data } = await supabase.from("course_modules").select("course_id").eq("id", moduleId).maybeSingle();
  return (data?.course_id as string | undefined) ?? null;
}

async function courseOfLesson(supabase: Supabase, lessonId: string) {
  const { data } = await supabase.from("course_lessons").select("module_id, course_modules(course_id)").eq("id", lessonId).maybeSingle();
  const m = data?.course_modules as { course_id: string } | { course_id: string }[] | null | undefined;
  return (Array.isArray(m) ? m[0]?.course_id : m?.course_id) ?? null;
}

/** Students who have started any of these lessons (any progress blocks deletion). */
async function progressCount(supabase: Supabase, lessonIds: string[]) {
  if (lessonIds.length === 0) return 0;
  const { count } = await supabase.from("lesson_progress").select("lesson_id", { count: "exact", head: true }).in("lesson_id", lessonIds);
  return count ?? 0;
}

async function lessonIdsOfCourse(supabase: Supabase, courseId: string) {
  const { data } = await supabase.from("course_lessons").select("id, course_modules!inner(course_id)").eq("course_modules.course_id", courseId);
  return (data ?? []).map((l) => l.id as string);
}

/* ------------------------------------------------------------------ */
/* Courses                                                             */
/* ------------------------------------------------------------------ */

function readCourse(fd: FormData) {
  return courseSchema.safeParse({
    title: str(fd, "title"),
    slug: str(fd, "slug"),
    summary: str(fd, "summary"),
    categoryId: str(fd, "categoryId"),
    status: str(fd, "status") || "draft",
    audience: str(fd, "audience") || "all_students",
    sequential: fd.get("sequential") === "on",
    passMark: str(fd, "passMark") || "75",
    badgeName: str(fd, "badgeName"),
    priceMzn: str(fd, "priceMzn") || "0",
    sortOrder: str(fd, "sortOrder") || "0",
  });
}

/** Create a course as a draft and open it in the editor. */
export async function createCourse(_prev: EditorResult | null, fd: FormData): Promise<EditorResult> {
  const { user } = await requireAdmin("admin");
  const parsed = readCourse(fd);
  if (!parsed.success) return issues(parsed.error);
  const c = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .insert({
      title: c.title, slug: c.slug, summary: c.summary, category_id: c.categoryId, status: "draft", audience: c.audience,
      sequential: c.sequential, pass_mark: c.passMark, badge_name: c.badgeName, price_mzn: c.priceMzn, sort_order: c.sortOrder, created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return failed(error, "The course could not be created.");
  await audit(supabase, "course.create", "courses", data.id, { slug: c.slug });
  refresh();
  redirect(`/admin/learning/${data.id}/edit?notice=created`);
}

/** Save course settings. Publishing is refused while the course has empty modules or quizzes. */
export async function saveCourse(courseId: string, _prev: EditorResult | null, fd: FormData): Promise<EditorResult> {
  await requireAdmin("admin");
  if (!isUuid(courseId)) return bad("Course not found.");
  const parsed = readCourse(fd);
  if (!parsed.success) return issues(parsed.error);
  const c = parsed.data;
  const supabase = await createClient();

  const { data: current } = await supabase.from("courses").select("status, published_at").eq("id", courseId).maybeSingle();
  if (!current) return bad("Course not found.");

  if (c.status === "published") {
    const { data: mods } = await supabase
      .from("course_modules")
      .select("title, course_lessons(title, lesson_type, quiz_questions(count))")
      .eq("course_id", courseId);
    type Row = { title: string; course_lessons: { title: string; lesson_type: EditorLessonType; quiz_questions: { count: number }[] }[] };
    const problems = publishProblems({
      modules: ((mods ?? []) as Row[]).map((m) => ({
        title: m.title,
        lessons: m.course_lessons.map((l) => ({ title: l.title, type: l.lesson_type, questions: l.quiz_questions[0]?.count ?? 0 })),
      })),
    });
    if (problems.length) return bad(`Not published yet: ${problems.join(" ")}`);
  }

  const { error } = await supabase
    .from("courses")
    .update({
      title: c.title, slug: c.slug, summary: c.summary, category_id: c.categoryId, status: c.status, audience: c.audience,
      sequential: c.sequential, pass_mark: c.passMark, badge_name: c.badgeName, price_mzn: c.priceMzn, sort_order: c.sortOrder,
      published_at: c.status === "draft" ? null : (current.published_at ?? new Date().toISOString()),
    })
    .eq("id", courseId);
  if (error) return failed(error, "The course could not be saved.");
  await audit(supabase, "course.update", "courses", courseId, { status: c.status, from: current.status });
  refresh(courseId);
  return { ok: true, message: c.status !== current.status ? `Saved. The course is now ${c.status}.` : "Saved." };
}

/** Raise the version after a content change, so new completions record it. */
export async function bumpCourseVersion(courseId: string): Promise<EditorResult> {
  await requireAdmin("admin");
  if (!isUuid(courseId)) return bad("Course not found.");
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("version").eq("id", courseId).maybeSingle();
  if (!data) return bad("Course not found.");
  const version = (data.version as number) + 1;
  const { error } = await supabase.from("courses").update({ version }).eq("id", courseId);
  if (error) return failed(error, "The version could not be raised.");
  await audit(supabase, "course.version", "courses", courseId, { version });
  refresh(courseId);
  return { ok: true, message: `Version ${version}. Students who completed earlier keep their badge with the earlier version.` };
}

/** Delete a draft course nobody has started. Anything else is archived instead. */
export async function deleteCourse(courseId: string): Promise<EditorResult> {
  await requireAdmin("admin");
  if (!isUuid(courseId)) return bad("Course not found.");
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("status, slug").eq("id", courseId).maybeSingle();
  if (!data) return bad("Course not found.");
  if (data.status !== "draft") return bad("Only draft courses can be deleted. Set the status to Archived instead.");
  const { count: grants } = await supabase.from("course_access").select("id", { count: "exact", head: true }).eq("course_id", courseId);
  if ((grants ?? 0) > 0 || (await progressCount(supabase, await lessonIdsOfCourse(supabase, courseId))) > 0) {
    return bad("Students already have access or progress in this course. Archive it instead.");
  }
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) return failed(error, "The course could not be deleted.");
  await audit(supabase, "course.delete", "courses", courseId, { slug: data.slug });
  refresh();
  redirect("/admin/learning?notice=deleted");
}

/* ------------------------------------------------------------------ */
/* Modules and lessons                                                 */
/* ------------------------------------------------------------------ */

type Ordered = "course_modules" | "course_lessons";

/** Swap positions with the neighbour. Positions are unique, so the first row parks on a free position first. */
async function move(supabase: Supabase, table: Ordered, parentKey: "course_id" | "module_id", id: string, direction: "up" | "down"): Promise<EditorResult> {
  const { data: row } = await supabase.from(table).select(`id, position, ${parentKey}`).eq("id", id).maybeSingle();
  if (!row) return bad("Not found.");
  const r = row as unknown as { id: string; position: number } & Record<string, string>;
  const q = supabase.from(table).select("id, position").eq(parentKey, r[parentKey]);
  const { data: other } = await (direction === "up"
    ? q.lt("position", r.position).order("position", { ascending: false })
    : q.gt("position", r.position).order("position", { ascending: true })
  ).limit(1).maybeSingle();
  if (!other) return { ok: true, message: "" };
  const parked = 30000 + r.position;
  for (const [rid, pos] of [[r.id, parked], [other.id as string, r.position], [r.id, other.position as number]] as const) {
    const { error } = await supabase.from(table).update({ position: pos }).eq("id", rid);
    if (error) return failed(error, "The order could not be changed.");
  }
  return { ok: true, message: "" };
}

async function nextPosition(supabase: Supabase, table: Ordered, parentKey: "course_id" | "module_id", parentId: string) {
  const { data } = await supabase.from(table).select("position").eq(parentKey, parentId).order("position", { ascending: false }).limit(1).maybeSingle();
  return ((data?.position as number | undefined) ?? 0) + 1;
}

export async function addModule(courseId: string, _prev: EditorResult | null, fd: FormData): Promise<EditorResult> {
  await requireAdmin("admin");
  if (!isUuid(courseId)) return bad("Course not found.");
  const parsed = moduleSchema.safeParse({ title: str(fd, "title"), objective: str(fd, "objective") });
  if (!parsed.success) return issues(parsed.error);
  const supabase = await createClient();
  const position = await nextPosition(supabase, "course_modules", "course_id", courseId);
  const { data, error } = await supabase
    .from("course_modules")
    .insert({ course_id: courseId, position, title: parsed.data.title, objective: parsed.data.objective })
    .select("id")
    .single();
  if (error) return failed(error, "The module could not be added.");
  await audit(supabase, "course_module.create", "course_modules", data.id, { course_id: courseId });
  refresh(courseId);
  return { ok: true, message: "Module added." };
}

export async function saveModule(moduleId: string, _prev: EditorResult | null, fd: FormData): Promise<EditorResult> {
  await requireAdmin("admin");
  if (!isUuid(moduleId)) return bad("Module not found.");
  const parsed = moduleSchema.safeParse({ title: str(fd, "title"), objective: str(fd, "objective") });
  if (!parsed.success) return issues(parsed.error);
  const supabase = await createClient();
  const courseId = await courseOfModule(supabase, moduleId);
  if (!courseId) return bad("Module not found.");
  const { error } = await supabase.from("course_modules").update({ title: parsed.data.title, objective: parsed.data.objective }).eq("id", moduleId);
  if (error) return failed(error, "The module could not be saved.");
  await audit(supabase, "course_module.update", "course_modules", moduleId);
  refresh(courseId);
  return { ok: true, message: "Saved." };
}

export async function moveModule(moduleId: string, direction: "up" | "down"): Promise<EditorResult> {
  await requireAdmin("admin");
  if (!isUuid(moduleId)) return bad("Module not found.");
  const supabase = await createClient();
  const courseId = await courseOfModule(supabase, moduleId);
  const r = await move(supabase, "course_modules", "course_id", moduleId, direction === "up" ? "up" : "down");
  if (r.ok) {
    await audit(supabase, "course_module.move", "course_modules", moduleId, { direction });
    refresh(courseId ?? undefined);
  }
  return r;
}

export async function deleteModule(moduleId: string): Promise<EditorResult> {
  await requireAdmin("admin");
  if (!isUuid(moduleId)) return bad("Module not found.");
  const supabase = await createClient();
  const courseId = await courseOfModule(supabase, moduleId);
  const { data: lessons } = await supabase.from("course_lessons").select("id").eq("module_id", moduleId);
  if ((await progressCount(supabase, (lessons ?? []).map((l) => l.id as string))) > 0) {
    return bad("Students have progress in this module, so it cannot be deleted. Edit it instead, or archive the course.");
  }
  const { error } = await supabase.from("course_modules").delete().eq("id", moduleId);
  if (error) return failed(error, "The module could not be deleted.");
  await audit(supabase, "course_module.delete", "course_modules", moduleId, { course_id: courseId });
  refresh(courseId ?? undefined);
  return { ok: true, message: "Module deleted." };
}

/** Add a lesson and open it in the lesson editor. */
export async function addLesson(moduleId: string, _prev: EditorResult | null, fd: FormData): Promise<EditorResult> {
  await requireAdmin("admin");
  if (!isUuid(moduleId)) return bad("Module not found.");
  const title = str(fd, "title").trim();
  const type = str(fd, "type") as EditorLessonType;
  if (title.length < 2 || title.length > 150) return { ok: false, message: "Enter a lesson title.", fields: { title: "Enter a lesson title." } };
  if (!["text", "quiz", "video", "link"].includes(type)) return bad("Choose a lesson type.");
  const supabase = await createClient();
  const courseId = await courseOfModule(supabase, moduleId);
  if (!courseId) return bad("Module not found.");
  const position = await nextPosition(supabase, "course_lessons", "module_id", moduleId);
  // A new video or link lesson starts as text until its link is added, so the database check is met.
  const startType = type === "quiz" ? "quiz" : "text";
  const { data, error } = await supabase
    .from("course_lessons")
    .insert({ module_id: moduleId, position, title, lesson_type: startType, body: startType === "text" ? "Escreva aqui o conteúdo da lição." : null })
    .select("id")
    .single();
  if (error) return failed(error, "The lesson could not be added.");
  await audit(supabase, "course_lesson.create", "course_lessons", data.id, { module_id: moduleId, type });
  refresh(courseId);
  redirect(`/admin/learning/${courseId}/lessons/${data.id}?type=${type}`);
}

export async function saveLesson(lessonId: string, _prev: EditorResult | null, fd: FormData): Promise<EditorResult> {
  await requireAdmin("admin");
  if (!isUuid(lessonId)) return bad("Lesson not found.");
  const parsed = lessonSchema.safeParse({
    title: str(fd, "title"),
    type: str(fd, "type"),
    videoUrl: str(fd, "videoUrl"),
    body: str(fd, "body"),
    linkUrl: str(fd, "linkUrl"),
    durationMinutes: str(fd, "durationMinutes"),
    isPreview: fd.get("isPreview") === "on",
  });
  if (!parsed.success) return issues(parsed.error);
  const l = parsed.data;
  if (l.type === "file") return bad("File lessons are not available in the editor yet.");
  const supabase = await createClient();
  const courseId = await courseOfLesson(supabase, lessonId);
  if (!courseId) return bad("Lesson not found.");
  const { error } = await supabase
    .from("course_lessons")
    .update({
      title: l.title, lesson_type: l.type, video_url: l.videoUrl, body: l.body, link_url: l.linkUrl,
      duration_minutes: l.durationMinutes, is_preview: l.isPreview,
    })
    .eq("id", lessonId);
  if (error) return failed(error, "The lesson could not be saved.");
  await audit(supabase, "course_lesson.update", "course_lessons", lessonId, { type: l.type });
  refresh(courseId);
  return { ok: true, message: "Saved." };
}

export async function moveLesson(lessonId: string, direction: "up" | "down"): Promise<EditorResult> {
  await requireAdmin("admin");
  if (!isUuid(lessonId)) return bad("Lesson not found.");
  const supabase = await createClient();
  const courseId = await courseOfLesson(supabase, lessonId);
  const r = await move(supabase, "course_lessons", "module_id", lessonId, direction === "up" ? "up" : "down");
  if (r.ok) {
    await audit(supabase, "course_lesson.move", "course_lessons", lessonId, { direction });
    refresh(courseId ?? undefined);
  }
  return r;
}

export async function deleteLesson(lessonId: string): Promise<EditorResult> {
  await requireAdmin("admin");
  if (!isUuid(lessonId)) return bad("Lesson not found.");
  const supabase = await createClient();
  const courseId = await courseOfLesson(supabase, lessonId);
  if ((await progressCount(supabase, [lessonId])) > 0) {
    return bad("Students have progress in this lesson, so it cannot be deleted. Edit it instead.");
  }
  const { error } = await supabase.from("course_lessons").delete().eq("id", lessonId);
  if (error) return failed(error, "The lesson could not be deleted.");
  await audit(supabase, "course_lesson.delete", "course_lessons", lessonId, { course_id: courseId });
  refresh(courseId ?? undefined);
  redirect(`/admin/learning/${courseId}/edit?notice=lesson-deleted`);
}

/* ------------------------------------------------------------------ */
/* Quiz questions                                                      */
/* ------------------------------------------------------------------ */

/**
 * Replace a quiz's questions. If students already answered this quiz, earlier
 * attempts refer to the old questions by position, so the results page notes
 * the change and the course version should be raised.
 */
export async function saveQuiz(
  lessonId: string,
  questions: { prompt: string; options: string[]; correctIndex: number; explanation: string }[],
): Promise<EditorResult> {
  await requireAdmin("admin");
  if (!isUuid(lessonId)) return bad("Quiz not found.");
  const parsed = quizSchema.safeParse(questions);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    const n = typeof i?.path[0] === "number" ? `Question ${i.path[0] + 1}: ` : "";
    return bad(`${n}${i?.message ?? "Check the questions."}`);
  }
  const supabase = await createClient();
  const { data: lesson } = await supabase.from("course_lessons").select("lesson_type").eq("id", lessonId).maybeSingle();
  if (!lesson) return bad("Quiz not found.");
  if (lesson.lesson_type !== "quiz") return bad("Set the lesson type to Quiz and save it first.");
  const courseId = await courseOfLesson(supabase, lessonId);

  // Keep the current questions so they can be put back if the new set is refused.
  const { data: previous } = await supabase
    .from("quiz_questions")
    .select("lesson_id, position, prompt, options, correct_index, explanation")
    .eq("lesson_id", lessonId);
  const { error: delError } = await supabase.from("quiz_questions").delete().eq("lesson_id", lessonId);
  if (delError) return failed(delError, "The questions could not be saved.");
  if (parsed.data.length) {
    const { error } = await supabase.from("quiz_questions").insert(
      parsed.data.map((q, i) => ({
        lesson_id: lessonId, position: i + 1, prompt: q.prompt, options: q.options, correct_index: q.correctIndex, explanation: q.explanation,
      })),
    );
    if (error) {
      if (previous?.length) {
        const { error: restoreError } = await supabase.from("quiz_questions").insert(previous);
        if (restoreError) console.error("quiz restore failed", restoreError.code, restoreError.message);
      }
      return failed(error, "The questions could not be saved. The previous questions were kept.");
    }
  }
  const { count: attempts } = await supabase.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("lesson_id", lessonId);
  await audit(supabase, "quiz.update", "course_lessons", lessonId, { questions: parsed.data.length, earlier_attempts: attempts ?? 0 });
  refresh(courseId ?? undefined);
  return {
    ok: true,
    message: (attempts ?? 0) > 0
      ? `Saved ${parsed.data.length} questions. Students already answered this quiz: raise the course version so results before and after the change can be told apart.`
      : `Saved ${parsed.data.length} questions.`,
  };
}

/* ------------------------------------------------------------------ */
/* Access codes and grants                                             */
/* ------------------------------------------------------------------ */

export async function createVoucher(courseId: string, _prev: EditorResult | null, fd: FormData): Promise<EditorResult> {
  const { user } = await requireAdmin("admin");
  if (!isUuid(courseId)) return bad("Course not found.");
  const parsed = voucherSchema.safeParse({ code: str(fd, "code"), maxUses: str(fd, "maxUses"), expiresOn: str(fd, "expiresOn"), sponsorName: str(fd, "sponsorName") });
  if (!parsed.success) return issues(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_vouchers")
    .insert({
      course_id: courseId, code: v.code, max_uses: v.maxUses, sponsor_name: v.sponsorName, created_by: user.id,
      expires_at: v.expiresOn ? `${v.expiresOn}T23:59:59+02:00` : null,
    })
    .select("id")
    .single();
  if (error) return failed(error, "The code could not be created.");
  await audit(supabase, "course_voucher.create", "course_vouchers", data.id, { course_id: courseId, code: v.code });
  refresh(courseId);
  return { ok: true, message: `Code ${v.code} created.` };
}

/** Stop a code from being used again. Students who already used it keep access. */
export async function disableVoucher(voucherId: string): Promise<EditorResult> {
  await requireAdmin("admin");
  if (!isUuid(voucherId)) return bad("Code not found.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("course_vouchers").update({ expires_at: new Date().toISOString() }).eq("id", voucherId).select("course_id, code").maybeSingle();
  if (error || !data) return error ? failed(error, "The code could not be disabled.") : bad("Code not found.");
  await audit(supabase, "course_voucher.disable", "course_vouchers", voucherId, { code: data.code });
  refresh(data.course_id as string);
  return { ok: true, message: `Code ${data.code} disabled.` };
}

/** Give one student access, for example after an M-Pesa payment or a scholarship. */
export async function grantAccess(courseId: string, _prev: EditorResult | null, fd: FormData): Promise<EditorResult> {
  await requireAdmin("admin");
  if (!isUuid(courseId)) return bad("Course not found.");
  const parsed = grantSchema.safeParse({
    email: str(fd, "email"), source: str(fd, "source"), amountMzn: str(fd, "amountMzn"), sponsorName: str(fd, "sponsorName"), note: str(fd, "note"),
  });
  if (!parsed.success) return issues(parsed.error);
  const g = parsed.data;
  const supabase = await createClient();
  const { data: student } = await supabase.from("profiles").select("id").eq("email", g.email).maybeSingle();
  if (!student) return { ok: false, message: "No student account uses that email.", fields: { email: "No student account uses that email." } };
  const { error } = await supabase.rpc("admin_grant_course_access", {
    p_user: student.id, p_course: courseId, p_source: g.source, p_amount_mzn: g.amountMzn, p_sponsor_name: g.sponsorName, p_note: g.note,
  });
  if (error) {
    if (error.code === "23505") return bad("This student already has access.");
    return failed(error, "Access could not be given.");
  }
  refresh(courseId);
  return { ok: true, message: `Access given to ${g.email}.` };
}

export async function revokeAccess(accessId: string, courseId: string): Promise<EditorResult> {
  await requireAdmin("admin");
  if (!isUuid(accessId) || !isUuid(courseId)) return bad("Access not found.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_revoke_course_access", { p_access: accessId, p_note: null });
  if (error) return failed(error, "Access could not be removed.");
  refresh(courseId);
  return { ok: true, message: "Access removed." };
}
