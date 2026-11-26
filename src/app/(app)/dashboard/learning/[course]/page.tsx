import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getOutline } from "@/lib/data/learning";
import { nextLesson, type LessonType } from "@/lib/learning/model";
import { cn } from "@/lib/cn";
import { T } from "@/i18n/client";
import { getLocale, getT } from "@/i18n/server";
import { LOCALE_TAGS } from "@/i18n/config";

const TYPE_LABELS: Record<LessonType, string> = { video: "Video", text: "Reading", quiz: "Quiz", file: "Download", link: "Link" };

export async function generateMetadata({ params }: PageProps<"/dashboard/learning/[course]">): Promise<Metadata> {
  const { course } = await params;
  const outline = await getOutline(course);
  const t = await getT();
  return { title: outline?.title ?? t("Learning") };
}

export default async function CoursePage({ params }: PageProps<"/dashboard/learning/[course]">) {
  await requireStudent("/dashboard/learning");
  const { course } = await params;
  const outline = await getOutline(course);
  if (!outline) notFound();
  const [t, locale] = await Promise.all([getT(), getLocale()]);

  const lessons = outline.modules.flatMap((m) => m.lessons);
  const done = lessons.filter((l) => l.completed).length;
  const next = nextLesson(outline);
  const started = done > 0;
  const base = `/dashboard/learning/${outline.slug}`;
  const minutes = lessons.reduce((s, l) => s + (l.duration_minutes ?? 0), 0);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/dashboard/learning" className="text-sm font-semibold text-indigo hover:underline">
        ← <T>{"All courses"}</T>
      </Link>

      <header>
        <h1 className="text-[clamp(24px,3vw,32px)] tracking-[-0.03em]">{outline.title}</h1>
        {outline.summary && <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">{outline.summary}</p>}
        <p className="mt-3 text-sm text-ink-muted">
          {[
            t("{n} modules", { n: outline.modules.length }),
            t("{n} lessons", { n: lessons.length }),
            minutes ? t("about {n} min", { n: minutes }) : null,
            outline.badge_name ? t("Badge: {badge}", { badge: outline.badge_name }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      {outline.completed_at ? (
        <Alert tone="success" title={t("Course completed")}>
          {t("Completed on {date}.", {
            date: new Date(outline.completed_at).toLocaleDateString(LOCALE_TAGS[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Maputo" }),
          })}{" "}
          {t("The badge “{badge}” is now on your profile and CV.", { badge: outline.badge_name ?? outline.title })}{" "}
          <Link href={`${base}/completed`} className="font-semibold underline">{t("See your badge")}</Link>
        </Alert>
      ) : !outline.can_enter ? (
        <Alert tone="info" title={outline.price_mzn > 0 ? t("This course costs {price} MZN", { price: outline.price_mzn.toLocaleString(LOCALE_TAGS[locale]) }) : t("This course is locked")}>
          {outline.prerequisites.some((p) => !p.completed)
            ? t("Complete first: {courses}.", { courses: outline.prerequisites.filter((p) => !p.completed).map((p) => p.title).join(", ") })
            : t("Online payment is coming soon. To get access now, contact Handson or use an access code on the Learning page.")}
        </Alert>
      ) : (
        next && (
          <div>
            <ButtonLink href={`${base}/${next.id}`}>{started ? t("Continue") : t("Start the course")}</ButtonLink>
          </div>
        )
      )}

      <ol className="flex flex-col gap-4">
        {outline.modules.map((m) => {
          const mDone = m.lessons.every((l) => l.completed) && m.lessons.length > 0;
          return (
            <li key={m.id} className="rounded-[var(--radius-lg)] border border-line bg-surface-raised p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-muted">{t("Module {n}", { n: m.position })}</p>
                  <h2 className="text-lg">{m.title}</h2>
                </div>
                {mDone ? <Badge tone="success">{"Completed"}</Badge> : !m.open && outline.can_enter ? <Badge tone="warning">{"Locked"}</Badge> : null}
              </div>
              {m.objective && <p className="mt-1 text-[15px] text-ink-muted">{m.objective}</p>}
              <ul className="mt-4 divide-y divide-line border-t border-line">
                {m.lessons.map((l) => {
                  const canOpen = (outline.can_enter && m.open) || l.is_preview;
                  const row = (
                    <span className="flex items-center justify-between gap-4 py-3 text-[15px]">
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            l.completed ? "bg-success text-white" : "border border-line-strong text-ink-muted",
                          )}
                        >
                          {l.completed ? "✓" : l.position}
                        </span>
                        <span className="truncate">{l.title}</span>
                      </span>
                      <span className="shrink-0 text-sm text-ink-muted">
                        {t(TYPE_LABELS[l.type])}
                        {l.duration_minutes ? ` · ${l.duration_minutes} min` : ""}
                        {l.is_preview && !outline.can_enter ? ` · ${t("Free preview")}` : ""}
                      </span>
                    </span>
                  );
                  return (
                    <li key={l.id}>
                      {canOpen ? (
                        <Link href={`${base}/${l.id}`} className="block hover:text-indigo">
                          <span className="sr-only">{l.completed ? t("Completed:") : ""}</span>
                          {row}
                        </Link>
                      ) : (
                        <span className="block text-ink-muted">{row}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
