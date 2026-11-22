import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { VoucherForm } from "@/components/learning/voucher-form";
import { Badge, EmptyState } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { getCatalogue } from "@/lib/data/learning";
import type { CatalogueCourse } from "@/lib/learning/model";
import { T } from "@/i18n/client";
import { getLocale, getT } from "@/i18n/server";
import { LOCALE_TAGS } from "@/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Learning") };
}

export default async function LearningPage() {
  await requireStudent("/dashboard/learning");
  const [courses, t, locale] = await Promise.all([getCatalogue(), getT(), getLocale()]);
  const price = (mzn: number) => `${mzn.toLocaleString(LOCALE_TAGS[locale])} MZN`;

  const status = (c: CatalogueCourse) => {
    if (c.completed_at) return <Badge tone="success">{"Completed"}</Badge>;
    if (c.lessons_completed > 0) return <Badge tone="indigo">{"In progress"}</Badge>;
    if (!c.has_access && c.price_mzn > 0) return <Badge>{price(c.price_mzn)}</Badge>;
    if (!c.can_enter) return <Badge tone="warning">{"Locked"}</Badge>;
    return <Badge>{"Free"}</Badge>;
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Learning" lead="Short courses to prepare you for work. Completing a course adds a badge to your profile and CV." />

      {courses.length === 0 ? (
        <EmptyState title="Courses are on the way">{"The first course, on preparing for work, will appear here soon."}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-4">
          {courses.map((c) => {
            const pct = c.lessons_total ? Math.round((100 * c.lessons_completed) / c.lessons_total) : 0;
            return (
              <li key={c.id}>
                <Link
                  href={`/dashboard/learning/${c.slug}`}
                  className="block rounded-[var(--radius-lg)] border border-line bg-surface-raised p-5 transition-colors hover:border-indigo sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      {(locale === "pt" ? c.category_name_pt : c.category_name) && (
                        <p className="text-sm font-semibold text-indigo">{locale === "pt" ? c.category_name_pt : c.category_name}</p>
                      )}
                      <h2 className="mt-0.5 text-xl">{c.title}</h2>
                    </div>
                    {status(c)}
                  </div>
                  {c.summary && <p className="mt-2 text-[15px] text-ink-muted">{c.summary}</p>}
                  {c.lessons_total > 0 && c.can_enter && !c.completed_at && (
                    <div className="mt-4">
                      <div className="h-1.5 overflow-hidden rounded-full bg-indigo-soft" aria-hidden>
                        <div className="h-full rounded-full bg-indigo" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1.5 text-sm text-ink-muted">
                        {t("{done} of {total} lessons", { done: c.lessons_completed, total: c.lessons_total })}
                      </p>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Panel title="Have an access code?">
        <VoucherForm />
      </Panel>
      <p className="text-sm text-ink-muted">
        <T>{"Videos are played from YouTube in privacy-enhanced mode."}</T>
      </p>
    </div>
  );
}
