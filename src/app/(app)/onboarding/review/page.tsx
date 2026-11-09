import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { finishOnboarding } from "@/app/(app)/onboarding/actions";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth/session";
import { countryOptions } from "@/lib/countries";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/files";
import { getCatalogues } from "@/lib/data/catalogues";
import {
  MISSING_LABELS,
  getCompletion,
  getDocuments,
  getEducation,
  getExperiences,
  getInterests,
  getProfile,
  getSkills,
} from "@/lib/data/student";
import {
  ACADEMIC_STATUS_LABELS,
  ARRANGEMENT_LABELS,
  AVAILABILITY_LABELS,
  EXPERIENCE_LABELS,
  PROFICIENCY_LABELS,
  SECTION_LABELS,
} from "@/lib/onboarding/labels";

export const metadata: Metadata = { title: "Review your profile" };

function Section({ id, score, weight, missing, children }: { id: string; score: number; weight: number; missing: string[]; children: ReactNode }) {
  const meta = SECTION_LABELS[id];
  const complete = score >= weight;
  return (
    <section className="border-t border-line py-6 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl">{meta.title}</h2>
          {complete ? <Badge tone="success">Complete</Badge> : <Badge tone="warning">Needs attention</Badge>}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm tabular-nums text-ink-muted">
            {Math.round(score)} / {weight}%
          </span>
          <Link href={meta.href} className="text-sm font-semibold text-indigo hover:underline">
            Edit
          </Link>
        </div>
      </div>
      <div className="mt-3 text-[15px]">{children}</div>
      {missing.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm text-warning">
          {missing.map((m) => (
            <li key={m}>• {MISSING_LABELS[m] ?? m}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

const muted = (text: string) => <p className="text-ink-muted">{text}</p>;

export default async function ReviewPage({ searchParams }: PageProps<"/onboarding/review">) {
  const user = await requireUser("/onboarding/review");
  const [profile, completion, education, skills, interests, experiences, documents, catalogues, sp] = await Promise.all([
    getProfile(user.id),
    getCompletion(user.id),
    getEducation(user.id),
    getSkills(user.id),
    getInterests(user.id),
    getExperiences(user.id),
    getDocuments(user.id),
    getCatalogues(),
    searchParams,
  ]);

  if (!profile || !completion) {
    return <Alert tone="danger">Your profile could not be loaded. Please refresh the page.</Alert>;
  }

  const s = completion.sections;
  const countries = countryOptions("en");
  const countryName = (code: string | null) =>
    [...countries.priority, ...countries.rest].find((c) => c.code === code)?.name ?? code ?? "";
  const province = catalogues.provinces.find((p) => p.id === profile.province_id)?.name;
  const names = (ids: number[], list: { id: number; name: string }[]) =>
    ids.map((id) => list.find((x) => x.id === id)?.name).filter(Boolean).join(", ");
  const finished = !!profile.onboarding_completed_at;

  return (
    <>
      <header className="mb-8">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-indigo">Final step</p>
        <h1 className="mt-2 text-[clamp(28px,4vw,38px)] tracking-[-0.03em]">Review your profile</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Your profile is <strong className="text-ink">{completion.total}% complete</strong>. You can finish now and keep improving it from
          your dashboard. It stays private until you choose to share it with employers.
        </p>
      </header>

      {sp.error === "finish" && <Alert tone="danger" className="mb-6">Something went wrong. Please try again.</Alert>}

      <div className="rounded-[16px] border border-line p-5 sm:p-6">
        <Section id="personal" {...s.personal}>
          <p className="font-medium">{[profile.first_name, profile.middle_name, profile.surname].filter(Boolean).join(" ") || "Name not added"}</p>
          <p className="text-ink-muted">
            {[profile.city, province, countryName(profile.country_code)].filter(Boolean).join(", ")}
            {profile.phone ? ` · ${profile.phone}` : ""}
          </p>
        </Section>

        <Section id="education" {...s.education}>
          {education.length === 0
            ? muted("No qualifications added.")
            : (
              <ul className="flex flex-col gap-1">
                {education.map((e) => (
                  <li key={e.id}>
                    <span className="font-medium">
                      {e.qualification_name || catalogues.qualificationTypes.find((q) => q.id === e.qualification_type_id)?.name}
                    </span>
                    <span className="text-ink-muted">
                      {" "}· {catalogues.institutions.find((i) => i.id === e.institution_id)?.name ?? e.institution_name_other} ·{" "}
                      {ACADEMIC_STATUS_LABELS[e.academic_status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </Section>

        <Section id="skills" {...s.skills}>
          {skills.length === 0
            ? muted("No skills added.")
            : (
              <ul className="flex flex-wrap gap-2">
                {skills.map((k) => (
                  <li key={k.id}>
                    <Badge tone="indigo">
                      {k.custom_skill_name ?? catalogues.skills.find((x) => x.id === k.skill_id)?.name} · {PROFICIENCY_LABELS[k.proficiency]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
        </Section>

        <Section id="interests" {...s.interests}>
          {!interests
            ? muted("No preferences added.")
            : (
              <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[180px_1fr]">
                <dt className="text-ink-muted">Industries</dt>
                <dd>{names(interests.industryIds, catalogues.industries) || "—"}</dd>
                <dt className="text-ink-muted">Job functions</dt>
                <dd>{names(interests.jobFunctionIds, catalogues.jobFunctions) || "—"}</dd>
                <dt className="text-ink-muted">Locations</dt>
                <dd>{names(interests.provinceIds, catalogues.provinces) || "—"}</dd>
                <dt className="text-ink-muted">Work arrangement</dt>
                <dd>{interests.work_arrangements.map((w) => ARRANGEMENT_LABELS[w]).join(", ") || "—"}</dd>
                <dt className="text-ink-muted">Available</dt>
                <dd>
                  {interests.availability ? AVAILABILITY_LABELS[interests.availability] : "—"}
                  {interests.available_from ? ` (${interests.available_from})` : ""}
                </dd>
              </dl>
            )}
        </Section>

        <Section id="experience" {...s.experience}>
          {experiences.length === 0
            ? muted("No experience added.")
            : (
              <ul className="flex flex-col gap-1">
                {experiences.map((x) => (
                  <li key={x.id}>
                    <span className="font-medium">{x.role_title}</span>
                    <span className="text-ink-muted"> · {x.organisation} · {EXPERIENCE_LABELS[x.experience_type]}</span>
                  </li>
                ))}
              </ul>
            )}
        </Section>

        <Section id="documents" {...s.documents}>
          <p>
            {documents.length === 0
              ? "No documents uploaded."
              : documents.map((d) => DOCUMENT_TYPE_LABELS[d.document_type as DocumentType] ?? d.title).join(", ")}
          </p>
          <p className="text-ink-muted">
            Links: {[profile.linkedin_url && "LinkedIn", profile.github_url && "GitHub", profile.portfolio_url && "Portfolio"].filter(Boolean).join(" · ") || "none added"}
          </p>
        </Section>
      </div>

      <div className="mt-10 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/onboarding/documents" className={buttonClasses({ variant: "ghost" })}>
          ← Back
        </Link>
        {finished ? (
          <ButtonLink href="/dashboard">Go to my dashboard</ButtonLink>
        ) : (
          <form action={finishOnboarding}>
            <Button type="submit" fullWidth>
              Finish and go to my dashboard
            </Button>
          </form>
        )}
      </div>
    </>
  );
}
