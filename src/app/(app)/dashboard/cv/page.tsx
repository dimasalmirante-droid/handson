import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { loadCv } from "@/lib/cv/data";
import { CV_HEADINGS, cvGaps, type CvEntry } from "@/lib/cv/model";

export const metadata: Metadata = { title: "My CV" };

const GAP_LINKS: Record<string, { label: string; href: string }> = {
  name: { label: "Add your name", href: "/dashboard/profile" },
  headline: { label: "Write a professional headline", href: "/dashboard/profile" },
  education: { label: "Add at least one qualification", href: "/dashboard/education" },
  experience: { label: "Add an internship, job, volunteering, project or activity", href: "/dashboard/experience" },
  skills: { label: "Add your skills", href: "/dashboard/skills" },
};

function Entries({ items }: { items: CvEntry[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((e, i) => (
        <li key={i}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <p className="font-semibold">{e.title}</p>
            {e.period && <p className="text-sm text-ink-muted">{e.period}</p>}
          </div>
          {e.subtitle && <p className="text-[15px] text-ink-muted">{e.subtitle}</p>}
          {e.body && <p className="mt-1 whitespace-pre-line text-[15px]">{e.body}</p>}
        </li>
      ))}
    </ul>
  );
}

export default async function CvPage() {
  const user = await requireStudent("/dashboard/cv");
  const cv = await loadCv(user.id, "pt");
  if (!cv) return <Alert tone="danger">Your profile could not be loaded. Please refresh the page.</Alert>;

  const gaps = cvGaps(cv);
  const h = CV_HEADINGS.pt;

  return (
    <>
      <PageHeader
        title="My CV"
        lead="A clean CV built from your profile, free. Update your profile and the CV updates with it. Your CV is not shared with anyone unless you send it."
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <ButtonLink href="/cv?download=1" prefetch={false}>Download CV (Portuguese)</ButtonLink>
        <ButtonLink href="/cv?lang=en&download=1" prefetch={false} variant="secondary">Download CV (English)</ButtonLink>
        <ButtonLink href="/cv" prefetch={false} variant="ghost" target="_blank" rel="noopener">Open PDF</ButtonLink>
      </div>
      <p className="mb-6 text-[15px] text-ink-muted">
        Prefer to send a link? <Link className="font-semibold text-indigo hover:underline" href="/dashboard/settings#public-profile">Turn on your public profile</Link>.
      </p>

      {gaps.length > 0 && (
        <Alert tone="warning" className="mb-6" title="Your CV will be stronger if you:">
          <ul className="mt-1 flex flex-col gap-1">
            {gaps.map((g) => (
              <li key={g}>
                • <Link className="font-medium underline" href={GAP_LINKS[g].href}>{GAP_LINKS[g].label}</Link>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <Panel title="Preview">
        <article lang="pt" className="flex flex-col gap-6">
          <header>
            <h2 className="text-2xl">{cv.name || "Your name"}</h2>
            {cv.headline && <p className="mt-1 font-medium text-indigo">{cv.headline}</p>}
            {cv.contact.length > 0 && <p className="mt-1 text-sm text-ink-muted">{cv.contact.join(" · ")}</p>}
          </header>
          {cv.summary && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.08em] text-indigo">{h.profile}</h3>
              <p className="whitespace-pre-line text-[15px]">{cv.summary}</p>
            </section>
          )}
          {cv.education.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.08em] text-indigo">{h.education}</h3>
              <Entries items={cv.education} />
            </section>
          )}
          {cv.experience.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.08em] text-indigo">{h.experience}</h3>
              <Entries items={cv.experience} />
            </section>
          )}
          {cv.skills.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.08em] text-indigo">{h.skills}</h3>
              <p className="text-[15px]">{cv.skills.join(" · ")}</p>
            </section>
          )}
          {cv.languages.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.08em] text-indigo">{h.languages}</h3>
              <p className="text-[15px]">{cv.languages.join(" · ")}</p>
            </section>
          )}
        </article>
      </Panel>
    </>
  );
}
