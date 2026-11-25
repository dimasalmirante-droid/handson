import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/feedback";
import { getPublicPhotoUrl, getPublicProfile } from "@/lib/data/public-profile";
import { T } from "@/i18n/client";
import { getLocale, getT } from "@/i18n/server";
import { LOCALE_TAGS, type Locale } from "@/i18n/config";
import { ACADEMIC_STATUS_LABELS, EXPERIENCE_LABELS, LANGUAGE_LEVEL_LABELS, PROFICIENCY_LABELS } from "@/lib/onboarding/labels";

/** Shared profiles are for people the student sends the link to, not for search engines. */
const ROBOTS: Metadata["robots"] = { index: false, follow: false };

const monthYear = (d: string | null, locale: Locale) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString(LOCALE_TAGS[locale], { month: "short", year: "numeric" }) : null;

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPublicProfile(slug);
  const t = await getT();
  if (!p) return { title: t("Profile not found"), robots: ROBOTS };
  const name = [p.first_name, p.surname].filter(Boolean).join(" ");
  return { title: name, description: p.headline ?? undefined, robots: ROBOTS };
}

function Heading({ children }: { children: string }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-indigo"><T>{children}</T></h2>;
}

export default async function PublicProfilePage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const p = await getPublicProfile(slug);
  if (!p) notFound();
  const t = await getT();
  const locale = await getLocale();
  const pt = locale === "pt";

  const name = [p.first_name, p.surname].filter(Boolean).join(" ");
  const photo = await getPublicPhotoUrl(p.photo_path);
  const initials = `${p.first_name?.[0] ?? ""}${p.surname?.[0] ?? ""}`.toUpperCase() || "?";
  const location = p.location
    ? [p.location.district ?? p.location.city, pt ? p.location.province_pt : p.location.province_en].filter(Boolean).join(", ")
    : null;

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {p.sections.includes("photo") &&
          (photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
            <img src={photo} alt="" className="size-24 shrink-0 rounded-full object-cover" />
          ) : (
            <div aria-hidden className="grid size-24 shrink-0 place-items-center rounded-full bg-indigo-soft text-2xl font-semibold text-indigo">
              {initials}
            </div>
          ))}
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[clamp(28px,4vw,38px)] tracking-[-0.03em]">{name}</h1>
            {p.verified && <Badge tone="success">{t("Profile verified by Handson")}</Badge>}
          </div>
          {p.headline && <p className="mt-1 text-lg font-medium text-indigo">{p.headline}</p>}
          {(location || p.linkedin_url) && (
            <p className="mt-1 text-[15px] text-ink-muted">
              {location}
              {location && p.linkedin_url ? " · " : ""}
              {p.linkedin_url && (
                <a href={p.linkedin_url} className="font-semibold text-indigo hover:underline" target="_blank" rel="noopener noreferrer nofollow">
                  <T>{"LinkedIn"}</T>
                </a>
              )}
            </p>
          )}
        </div>
      </header>

      {p.summary && (
        <section>
          <Heading>{"Profile"}</Heading>
          <p className="whitespace-pre-line">{p.summary}</p>
        </section>
      )}

      {p.education && p.education.length > 0 && (
        <section>
          <Heading>{"Education"}</Heading>
          <ul className="flex flex-col gap-4">
            {p.education.map((e, i) => {
              const qualification = e.qualification_name || (pt ? e.qualification_pt : e.qualification_en);
              const field = pt ? e.field_pt : e.field_en;
              const title = field && !qualification.toLowerCase().includes(field.toLowerCase()) ? t("{qualification} in {field}", { qualification, field }) : qualification;
              const years = e.end_year ? `${e.start_year} – ${e.end_year}` : e.status === "enrolled" ? `${e.start_year} – ${t("present")}` : String(e.start_year);
              return (
                <li key={i}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <p className="font-semibold">
                      {title} {e.verified && <Badge tone="success" className="ml-1 align-middle">{t("Verified")}</Badge>}
                    </p>
                    <p className="text-sm text-ink-muted">{years}</p>
                  </div>
                  <p className="text-[15px] text-ink-muted">
                    {[e.institution, e.status !== "graduated" ? t(ACADEMIC_STATUS_LABELS[e.status]) : null].filter(Boolean).join(" · ")}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {p.experience && p.experience.length > 0 && (
        <section>
          <Heading>{"Experience"}</Heading>
          <ul className="flex flex-col gap-4">
            {p.experience.map((x, i) => (
              <li key={i}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="font-semibold">{x.role_title}</p>
                  <p className="text-sm text-ink-muted">
                    {monthYear(x.start_date, locale)} – {x.is_current ? t("present") : monthYear(x.end_date, locale)}
                  </p>
                </div>
                <p className="text-[15px] text-ink-muted">{[x.organisation, t(EXPERIENCE_LABELS[x.type] ?? ""), x.location].filter(Boolean).join(" · ")}</p>
                {x.description && <p className="mt-1 whitespace-pre-line text-[15px]">{x.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.skills && p.skills.length > 0 && (
        <section>
          <Heading>{"Skills"}</Heading>
          <ul className="flex flex-wrap gap-2">
            {p.skills.map((k, i) => (
              <li key={i} className="rounded-[var(--radius-pill)] bg-surface px-3 py-1.5 text-[15px] ring-1 ring-inset ring-line">
                {pt ? k.name_pt : k.name_en} <span className="text-ink-muted">· {t(PROFICIENCY_LABELS[k.proficiency] ?? k.proficiency)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.languages && p.languages.length > 0 && (
        <section>
          <Heading>{"Languages"}</Heading>
          <ul className="flex flex-wrap gap-2">
            {p.languages.map((l, i) => (
              <li key={i} className="rounded-[var(--radius-pill)] bg-surface px-3 py-1.5 text-[15px] ring-1 ring-inset ring-line">
                {pt ? l.name_pt : l.name_en} <span className="text-ink-muted">· {t(LANGUAGE_LEVEL_LABELS[l.level] ?? l.level)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.courses && p.courses.length > 0 && (
        <section>
          <Heading>{"Handson courses"}</Heading>
          <ul className="flex flex-wrap gap-2">
            {p.courses.map((c, i) => (
              <li key={i} className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-lime px-3 py-1.5 text-[15px] font-semibold text-ink">
                ★ {c.badge_name ?? c.title}
                <span className="font-normal">· {monthYear(c.completed_at.slice(0, 10), locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="border-t border-line pt-6 text-sm text-ink-muted">
        {t("Shared by the candidate through Handson. Contact details are shared only by the candidate.")}
      </footer>
    </article>
  );
}
