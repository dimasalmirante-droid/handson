import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CatalogueCourse, Completion, CourseOutline, Lesson, QuizQuestion } from "@/lib/learning/model";

export type { CatalogueCourse, Completion, CourseOutline, Lesson, QuizQuestion } from "@/lib/learning/model";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isCourseSlug = (s: string) => s.length >= 3 && s.length <= 80 && SLUG.test(s);
export const isUuid = (s: string) => UUID.test(s);

/** Courses the signed-in student can see, with access and progress. The database decides visibility. */
export const getCatalogue = cache(async (): Promise<CatalogueCourse[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("course_catalogue");
  if (error) {
    console.error("course_catalogue failed", error.code, error.message);
    return [];
  }
  return (data ?? []) as CatalogueCourse[];
});

export const getOutline = cache(async (slug: string): Promise<CourseOutline | null> => {
  if (!isCourseSlug(slug)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("course_outline", { p_slug: slug });
  if (error) {
    console.error("course_outline failed", error.code, error.message);
    return null;
  }
  return (data as CourseOutline | null) ?? null;
});

/** Lesson content; null when Row Level Security does not let the student open it. */
export const getLesson = cache(async (id: string): Promise<Lesson | null> => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_lessons")
    .select("id, module_id, title, lesson_type, video_url, body, link_url, duration_minutes")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("course_lessons read failed", error.code, error.message);
    return null;
  }
  return (data as Lesson | null) ?? null;
});

/** Quiz questions without the answers (the database never returns them to students). */
export async function getQuiz(lessonId: string): Promise<QuizQuestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quiz_for_lesson", { p_lesson: lessonId });
  if (error) {
    console.error("quiz_for_lesson failed", error.code, error.message);
    return [];
  }
  return (data ?? []) as QuizQuestion[];
}

/** Completed courses (badges) of a student, newest first. Readable by the student and administrators. */
export const getCompletions = cache(async (userId: string): Promise<Completion[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_completions")
    .select("course_id, completed_at, courses(title, badge_name)")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false });
  if (error) {
    console.error("course_completions read failed", error.code, error.message);
    return [];
  }
  type Row = { course_id: string; completed_at: string; courses: { title: string; badge_name: string | null } | { title: string; badge_name: string | null }[] | null };
  return ((data ?? []) as Row[]).flatMap((r) => {
    const c = Array.isArray(r.courses) ? r.courses[0] : r.courses;
    return c ? [{ course_id: r.course_id, completed_at: r.completed_at, title: c.title, badge_name: c.badge_name }] : [];
  });
});
