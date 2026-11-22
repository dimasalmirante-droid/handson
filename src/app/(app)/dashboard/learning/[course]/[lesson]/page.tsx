import { randomInt } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompleteButton } from "@/components/learning/complete-button";
import { LessonBody } from "@/components/learning/lesson-body";
import { Quiz } from "@/components/learning/quiz";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getLesson, getOutline, getQuiz } from "@/lib/data/learning";
import { youtubeEmbedUrl } from "@/lib/learning/youtube";
import { T } from "@/i18n/client";
import { getT } from "@/i18n/server";

export async function generateMetadata({ params }: PageProps<"/dashboard/learning/[course]/[lesson]">): Promise<Metadata> {
  const { lesson } = await params;
  const l = await getLesson(lesson);
  const t = await getT();
  return { title: l?.title ?? t("Learning") };
}

export default async function LessonPage({ params }: PageProps<"/dashboard/learning/[course]/[lesson]">) {
  await requireStudent("/dashboard/learning");
  const { course, lesson: lessonId } = await params;
  const [outline, lesson] = await Promise.all([getOutline(course), getLesson(lessonId)]);
  if (!outline || !lesson) notFound();

  const flat = outline.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, module: m })));
  const index = flat.findIndex((l) => l.id === lesson.id);
  if (index < 0) notFound();
  const here = flat[index];
  const t = await getT();
  const base = `/dashboard/learning/${outline.slug}`;
  const next = flat[index + 1];
  const nextHref = next ? `${base}/${next.id}` : base;
  const prev = flat[index - 1];
  const canProgress = outline.can_enter && here.module.open;
  const embed = lesson.lesson_type === "video" ? youtubeEmbedUrl(lesson.video_url) : null;
  const questions = lesson.lesson_type === "quiz" ? await getQuiz(lesson.id) : [];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href={base} className="text-sm font-semibold text-indigo hover:underline">
        ← {outline.title}
      </Link>

      <header>
        <p className="text-sm font-semibold text-ink-muted">
          {t("Module {n}", { n: here.module.position })} · {here.module.title}
        </p>
        <h1 className="mt-1 text-[clamp(22px,3vw,30px)] tracking-[-0.03em]">{lesson.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t("Lesson {n} of {total}", { n: index + 1, total: flat.length })}</p>
      </header>

      {embed && (
        <div className="aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] bg-ink">
          <iframe
            src={embed}
            title={lesson.title}
            className="size-full"
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      )}
      {lesson.lesson_type === "video" && !embed && <Alert tone="warning"><T>{"This video is not available right now."}</T></Alert>}

      {lesson.body && (
        <section aria-label={t("Summary")} className="rounded-[var(--radius-lg)] border border-line bg-surface-raised p-5 sm:p-6">
          {lesson.lesson_type === "video" && <h2 className="mb-3 text-lg"><T>{"Summary"}</T></h2>}
          <LessonBody source={lesson.body} />
        </section>
      )}

      {lesson.lesson_type === "link" && lesson.link_url && (
        <div>
          <ButtonLink href={lesson.link_url} variant="secondary" target="_blank" rel="noopener noreferrer">
            <T>{"Open the resource"}</T> ↗
          </ButtonLink>
        </div>
      )}

      {lesson.lesson_type === "quiz" ? (
        questions.length > 0 ? (
          canProgress ? (
            <Quiz
              key={`${lesson.id}-${here.completed}`}
              lessonId={lesson.id}
              courseSlug={outline.slug}
              questions={questions}
              passMark={outline.pass_mark}
              bestScore={here.best_score}
              nextHref={nextHref}
              seed={randomInt(1, 2 ** 31 - 1)}
            />
          ) : (
            <Alert tone="info"><T>{"Get access to this course to take the quiz."}</T></Alert>
          )
        ) : (
          <Alert tone="info"><T>{"This quiz is not available yet."}</T></Alert>
        )
      ) : canProgress ? (
        here.completed ? (
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-[15px] text-success">✓ <T>{"Completed"}</T></p>
            <ButtonLink href={nextHref} variant="secondary">{next ? t("Next lesson") : t("Back to the course")}</ButtonLink>
          </div>
        ) : (
          <CompleteButton lessonId={lesson.id} courseSlug={outline.slug} nextHref={nextHref} courseHref={base} />
        )
      ) : (
        <Alert tone="info"><T>{"This is a free preview. Get access to the course to continue."}</T></Alert>
      )}

      <nav aria-label={t("Lessons")} className="flex justify-between gap-4 border-t border-line pt-4 text-sm font-semibold">
        {prev ? <Link href={`${base}/${prev.id}`} className="text-indigo hover:underline">← {prev.title}</Link> : <span />}
        {next && (here.completed || here.is_preview) ? (
          <Link href={nextHref} className="text-right text-indigo hover:underline">{next.title} →</Link>
        ) : null}
      </nav>
    </div>
  );
}
