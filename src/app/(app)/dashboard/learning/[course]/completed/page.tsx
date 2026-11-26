import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { requireStudent } from "@/lib/auth/session";
import { getCatalogue, getOutline } from "@/lib/data/learning";
import { getProfile } from "@/lib/data/student";
import { suggestedCourse } from "@/lib/learning/model";
import { T } from "@/i18n/client";
import { getLocale, getT } from "@/i18n/server";
import { LOCALE_TAGS } from "@/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Course completed") };
}

/** Shown once a course is completed: what the student earned, where it appears, and what to do next. */
export default async function CourseCompletedPage({ params }: PageProps<"/dashboard/learning/[course]/completed">) {
  const user = await requireStudent("/dashboard/learning");
  const { course } = await params;
  const [outline, catalogue, profile, t, locale] = await Promise.all([getOutline(course), getCatalogue(), getProfile(user.id), getT(), getLocale()]);
  if (!outline) notFound();
  const base = `/dashboard/learning/${outline.slug}`;
  if (!outline.completed_at) redirect(base);

  const lessons = outline.modules.flatMap((m) => m.lessons);
  const scores = lessons.filter((l) => l.type === "quiz" && l.best_score !== null).map((l) => l.best_score as number);
  const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const date = new Date(outline.completed_at).toLocaleDateString(LOCALE_TAGS[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Maputo" });
  const badge = outline.badge_name ?? outline.title;
  const next = suggestedCourse(catalogue.filter((c) => c.id !== outline.id));

  const isPublic = Boolean(profile?.public_profile_enabled && profile.public_slug);
  const showsCourses = isPublic && Boolean(profile?.public_sections.includes("courses"));

  const places: { label: string; status: string; href: string; action: string }[] = [
    { label: t("Your profile"), status: t("Added"), href: "/dashboard/profile", action: t("View profile") },
    { label: t("Your CV"), status: t("Added, under “Training”"), href: "/dashboard/cv", action: t("View CV") },
    showsCourses
      ? { label: t("Your public profile"), status: t("Visible to anyone with your link"), href: `/p/${profile!.public_slug}`, action: t("View public profile") }
      : {
          label: t("Your public profile"),
          status: isPublic ? t("Not shown: Handson courses are switched off") : t("Not shown: your public profile is off"),
          href: "/dashboard/settings#public-profile",
          action: t("Change in Settings"),
        },
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href={base} className="text-sm font-semibold text-indigo hover:underline">
        ← {outline.title}
      </Link>

      <section aria-labelledby="completed-title" className="overflow-hidden rounded-[var(--radius-lg)] bg-indigo text-on-indigo">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
          <div aria-hidden className="flex size-20 shrink-0 items-center justify-center rounded-full bg-lime text-4xl font-bold text-ink">
            ✓
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-lime"><T>{"Course completed"}</T></p>
            <h1 id="completed-title" className="mt-1 text-[clamp(24px,3.4vw,34px)] tracking-[-0.03em]">
              {profile?.first_name ? t("Well done, {name}!", { name: profile.first_name }) : t("Well done!")}
            </h1>
            <p className="mt-2 text-[16px] opacity-90">{t("You completed “{course}” on {date}.", { course: outline.title, date })}</p>
          </div>
        </div>
        <dl className="grid gap-px bg-white/15 sm:grid-cols-3">
          <div className="bg-indigo p-5">
            <dt className="text-sm opacity-80"><T>{"Badge earned"}</T></dt>
            <dd className="mt-1 font-semibold">{badge}</dd>
          </div>
          <div className="bg-indigo p-5">
            <dt className="text-sm opacity-80"><T>{"Lessons"}</T></dt>
            <dd className="mt-1 font-semibold">{t("All {n} completed", { n: lessons.length })}</dd>
          </div>
          <div className="bg-indigo p-5">
            <dt className="text-sm opacity-80"><T>{"Quiz result"}</T></dt>
            <dd className="mt-1 font-semibold">{score !== null ? `${score}%` : "–"}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="where-title" className="rounded-[var(--radius-lg)] border border-line bg-surface-raised p-5 sm:p-6">
        <h2 id="where-title" className="text-lg"><T>{"Where your badge appears"}</T></h2>
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {places.map((p) => (
            <li key={p.label} className="flex flex-wrap items-center justify-between gap-3 py-3 text-[15px]">
              <span>
                <span className="font-semibold">{p.label}</span>
                <span className="block text-sm text-ink-muted">{p.status}</span>
              </span>
              <Link href={p.href} className="text-sm font-semibold text-indigo hover:underline">{p.action}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="next-title" className="rounded-[var(--radius-lg)] border border-line bg-surface-raised p-5 sm:p-6">
        <h2 id="next-title" className="text-lg"><T>{"What to do next"}</T></h2>
        <p className="mt-1 text-[15px] text-ink-muted">
          {next
            ? t("Put what you learned to work: update your profile now, then continue with “{course}”.", { course: next.title })
            : t("Put what you learned to work: update your profile and CV now, while it is fresh.")}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href="/dashboard/profile">{t("Update my profile")}</ButtonLink>
          {next ? (
            <ButtonLink href={`/dashboard/learning/${next.slug}`} variant="secondary">{t("Next course")}</ButtonLink>
          ) : (
            <ButtonLink href="/dashboard/learning" variant="secondary">{t("All courses")}</ButtonLink>
          )}
        </div>
      </section>

      <p className="text-sm text-ink-muted">
        <T>{"You can open the lessons again at any time to review them. Retaking a quiz never lowers your result."}</T>{" "}
        <Link href={base} className="font-semibold text-indigo hover:underline"><T>{"Review the course"}</T></Link>
      </p>
    </div>
  );
}
