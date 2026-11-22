/** Learning (LMS) data shapes, as the database functions return them, and pure helpers. */

/** One course in the student's catalogue, as course_catalogue() returns it. */
export type CatalogueCourse = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category_slug: string | null;
  category_name: string | null;
  category_name_pt: string | null;
  price_mzn: number;
  badge_name: string | null;
  sequential: boolean;
  can_enter: boolean;
  has_access: boolean;
  lessons_total: number;
  lessons_completed: number;
  completed_at: string | null;
};

export type LessonType = "video" | "text" | "quiz" | "file" | "link";

export type OutlineLesson = {
  id: string;
  position: number;
  title: string;
  type: LessonType;
  duration_minutes: number | null;
  is_preview: boolean;
  completed: boolean;
  best_score: number | null;
};

export type OutlineModule = {
  id: string;
  position: number;
  title: string;
  objective: string | null;
  open: boolean;
  lessons: OutlineLesson[];
};

export type CourseOutline = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  price_mzn: number;
  badge_name: string | null;
  sequential: boolean;
  pass_mark: number;
  can_enter: boolean;
  prerequisites: { slug: string; title: string; completed: boolean }[];
  completed_at: string | null;
  modules: OutlineModule[];
};

export type Lesson = {
  id: string;
  module_id: string;
  title: string;
  lesson_type: LessonType;
  video_url: string | null;
  body: string | null;
  link_url: string | null;
  duration_minutes: number | null;
};

export type QuizQuestion = { id: string; question_position: number; prompt: string; options: string[] };

export type Completion = { course_id: string; completed_at: string; title: string; badge_name: string | null };

/** The course to suggest on the home page: one in progress first, then the first free course not yet completed. */
export function suggestedCourse(courses: CatalogueCourse[]): CatalogueCourse | null {
  const open = courses.filter((c) => c.can_enter && !c.completed_at && c.lessons_total > 0);
  return open.find((c) => c.lessons_completed > 0) ?? open[0] ?? null;
}

/** First lesson not yet completed in an open module, in course order. */
export function nextLesson(outline: CourseOutline): OutlineLesson | null {
  for (const m of outline.modules) {
    if (!m.open) continue;
    const l = m.lessons.find((x) => !x.completed);
    if (l) return l;
  }
  return null;
}
