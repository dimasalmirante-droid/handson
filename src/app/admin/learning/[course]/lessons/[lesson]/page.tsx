import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { DeleteLessonButton, LessonForm, QuizEditor } from "@/components/admin/course-editor";
import { Alert } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/admin";
import { LESSON_TYPES, type EditorLessonType } from "@/lib/learning/editor";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit lesson" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditLessonPage({ params, searchParams }: PageProps<"/admin/learning/[course]/lessons/[lesson]">) {
  await requireAdmin("admin");
  const { course: courseId, lesson: lessonId } = await params;
  const { type: requested } = await searchParams;
  if (!UUID.test(courseId) || !UUID.test(lessonId)) notFound();
  const supabase = await createClient();

  const { data: lesson } = await supabase
    .from("course_lessons")
    .select("id, title, lesson_type, video_url, body, link_url, duration_minutes, is_preview, position, course_modules!inner(course_id, position, title, courses(slug, title))")
    .eq("id", lessonId)
    .eq("course_modules.course_id", courseId)
    .maybeSingle();
  if (!lesson) notFound();

  const [{ data: questions }, { count: attempts }, { count: started }] = await Promise.all([
    supabase.from("quiz_questions").select("prompt, options, correct_index, explanation").eq("lesson_id", lessonId).order("position"),
    supabase.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("lesson_id", lessonId),
    supabase.from("lesson_progress").select("lesson_id", { count: "exact", head: true }).eq("lesson_id", lessonId),
  ]);

  const mod = (Array.isArray(lesson.course_modules) ? lesson.course_modules[0] : lesson.course_modules) as {
    position: number;
    title: string;
    courses: { slug: string; title: string } | { slug: string; title: string }[] | null;
  };
  const course = Array.isArray(mod.courses) ? mod.courses[0] : mod.courses;

  // A lesson added as "video" or "link" is stored as text until its link is saved.
  const type: EditorLessonType =
    typeof requested === "string" && (LESSON_TYPES as readonly string[]).includes(requested) && requested !== "file" && lesson.lesson_type === "text"
      ? (requested as EditorLessonType)
      : (lesson.lesson_type as EditorLessonType);
  const placeholder = lesson.body === "Escreva aqui o conteúdo da lição.";

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/admin/learning/${courseId}/edit`} className="text-sm font-semibold text-indigo hover:underline">← {course?.title ?? "Course"}</Link>
      <PageHeader title={lesson.title} lead={`Module ${mod.position}: ${mod.title} · lesson ${lesson.position}`} />
      {(started ?? 0) > 0 && (
        <Alert tone="info">{started} students have opened this lesson. Edits reach them straight away.</Alert>
      )}

      <Panel title="Lesson">
        <LessonForm
          lessonId={lessonId}
          initial={{
            title: lesson.title,
            type,
            videoUrl: lesson.video_url ?? "",
            body: placeholder ? "" : (lesson.body ?? ""),
            linkUrl: lesson.link_url ?? "",
            durationMinutes: lesson.duration_minutes ? String(lesson.duration_minutes) : "",
            isPreview: lesson.is_preview,
          }}
        />
      </Panel>

      {lesson.lesson_type === "quiz" ? (
        <Panel title="Questions">
          {(attempts ?? 0) > 0 && (
            <Alert tone="warning" className="mb-4">
              Students have already answered this quiz {attempts} times. Results are tracked by question number, so after a substantial change raise the
              course version on the course page.
            </Alert>
          )}
          <QuizEditor
            lessonId={lessonId}
            initial={(questions ?? []).map((q) => ({
              prompt: q.prompt,
              options: q.options as string[],
              correctIndex: q.correct_index,
              explanation: q.explanation ?? "",
            }))}
          />
        </Panel>
      ) : (
        type === "quiz" && <Alert tone="info">Save the lesson as a Quiz first, then add its questions here.</Alert>
      )}

      <Panel title="Delete">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[15px]">
          <p className="max-w-xl text-ink-muted">Only possible while no student has opened this lesson.</p>
          <DeleteLessonButton lessonId={lessonId} />
        </div>
      </Panel>
    </div>
  );
}
