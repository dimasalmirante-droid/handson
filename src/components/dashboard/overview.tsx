import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge, Progress } from "@/components/ui/feedback";
import type { Catalogues } from "@/lib/data/catalogues";
import {
  MISSING_LABELS,
  SECTION_DASHBOARD_HREF,
  type Completion,
  type DocumentRecord,
  type EducationRecord,
  type ExperienceRecord,
  type Notification,
  type StudentProfile,
  type StudentSkill,
} from "@/lib/data/student";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/files";
import { ACADEMIC_STATUS_LABELS, EXPERIENCE_LABELS, SECTION_LABELS } from "@/lib/onboarding/labels";
import { T } from "@/i18n/client";
import { LOCALE_TAGS, type Locale } from "@/i18n/config";

const VERIFICATION: Record<string, { tone: "neutral" | "indigo" | "success" | "danger"; label: string; note: string }> = {
  unverified: { tone: "neutral", label: "Not verified", note: "Handson will review your profile and documents." },
  pending: { tone: "indigo", label: "Under review", note: "Our team is reviewing your profile." },
  verified: { tone: "success", label: "Verified", note: "Your profile has been verified by Handson." },
  rejected: { tone: "danger", label: "Needs changes", note: "Some information could not be verified. Check your notifications." },
};

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-line bg-surface-raised p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg"><T>{title}</T></h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const editLink = (href: string, label = "Edit") => (
  <Link href={href} className="text-sm font-semibold text-indigo hover:underline"><T>{label}</T></Link>
);

const dateLabel = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleDateString(LOCALE_TAGS[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Maputo" });

export type OverviewProps = {
  profile: StudentProfile;
  photoUrl: string | null;
  completion: Completion | null;
  education: EducationRecord[];
  experiences: ExperienceRecord[];
  skills: StudentSkill[];
  documents: DocumentRecord[];
  notifications: Notification[];
  catalogues: Catalogues;
  notice?: string;
  locale: Locale;
};

/** Dashboard overview, rendered from the student's real records. */
export function Overview({ profile, photoUrl, completion, education, experiences, skills, documents, notifications, catalogues, notice, locale }: OverviewProps) {
  const initials = `${profile.first_name?.[0] ?? ""}${profile.surname?.[0] ?? ""}`.toUpperCase() || "?";
  const verification = VERIFICATION[profile.verification_status] ?? VERIFICATION.unverified;

  const sections = completion ? Object.entries(completion.sections) : [];
  const tasks = sections.flatMap(([key, s]) =>
    s.missing.map((m) => ({ key: `${key}-${m}`, label: MISSING_LABELS[m] ?? m, href: SECTION_DASHBOARD_HREF[key], section: SECTION_LABELS[key].title })),
  );
  const docTypes = new Set(documents.map((d) => d.document_type));
  const latestEducation = education[0];
  const skillName = (id: number | null, custom: string | null) => custom ?? catalogues.skills.find((k) => k.id === id)?.name ?? "Skill";

  return (
    <div className="flex flex-col gap-6">
      {notice === "onboarding-complete" && (
        <Alert tone="success" title="Your profile is set up">
          <T>{"You can keep improving it at any time. It stays private until you choose to share it."}</T>
        </Alert>
      )}
      {notice === "password-updated" && <Alert tone="success"><T>{"Your password has been updated."}</T></Alert>}

      <header className="flex items-center gap-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-full bg-lime">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
            <img src={photoUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center font-display text-xl font-bold" aria-hidden>{initials}</span>
          )}
        </div>
        <div>
          <h1 className="text-[clamp(26px,4vw,34px)] tracking-[-0.03em]">
            <T>{"Welcome back"}</T>{profile.first_name ? `, ${profile.first_name}` : ""}
          </h1>
          <p className="text-ink-muted">
            {latestEducation
              ? `${latestEducation.qualification_name || catalogues.qualificationTypes.find((q) => q.id === latestEducation.qualification_type_id)?.name || "Student"} · ${
                  catalogues.institutions.find((i) => i.id === latestEducation.institution_id)?.shortName ??
                  catalogues.institutions.find((i) => i.id === latestEducation.institution_id)?.name ??
                  latestEducation.institution_name_other ?? ""
                }`
              : <T>{"Complete your profile to stand out to employers."}</T>}
          </p>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title="Profile completion">
          <Progress value={completion?.total ?? 0} label={completion?.total === 100 ? "Complete" : "Overall"} />
          <ul className="mt-5 divide-y divide-line">
            {sections.map(([key, s]) => (
              <li key={key} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={SECTION_DASHBOARD_HREF[key]} className="text-[15px] font-medium hover:text-indigo">
                  <T>{SECTION_LABELS[key].title}</T>
                </Link>
                <span className="flex items-center gap-3">
                  <span className="text-sm tabular-nums text-ink-muted">{Math.round(s.score)}/{s.weight}%</span>
                  {s.score >= s.weight ? <Badge tone="success"><T>{"Complete"}</T></Badge> : <Badge tone="warning"><T>{"Needs attention"}</T></Badge>}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-6">
          <Card title="Profile status">
            <dl className="flex flex-col gap-4">
              <div>
                <dt className="text-sm text-ink-muted"><T>{"Visibility to employers"}</T></dt>
                <dd className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  {profile.employer_visibility ? <Badge tone="lime"><T>{"Visible to employers"}</T></Badge> : <Badge><T>{"Private"}</T></Badge>}
                  {editLink("/dashboard/settings#privacy", "Manage")}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted"><T>{"Verification"}</T></dt>
                <dd className="mt-1">
                  <Badge tone={verification.tone}>{verification.label}</Badge>
                  <p className="mt-1.5 text-sm text-ink-muted"><T>{verification.note}</T></p>
                </dd>
              </div>
            </dl>
          </Card>

          <Card title="Outstanding tasks">
            {tasks.length === 0 ? (
              <p className="text-ink-muted"><T>{"Nothing outstanding. Your profile is complete."}</T></p>
            ) : (
              <ul className="flex flex-col gap-2">
                {tasks.slice(0, 6).map((t) => (
                  <li key={t.key}>
                    <Link href={t.href} className="group flex items-start gap-2 text-[15px]">
                      <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-warning" />
                      <span>
                        <span className="font-medium group-hover:text-indigo"><T>{t.label}</T></span>
                        <span className="block text-sm text-ink-muted"><T>{t.section}</T></span>
                      </span>
                    </Link>
                  </li>
                ))}
                {tasks.length > 6 && <li className="text-sm text-ink-muted">+ {tasks.length - 6}{" "}<T>{"more"}</T></li>}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Education" action={editLink("/dashboard/education")}>
          {education.length === 0 ? (
            <p className="text-ink-muted"><T>{"No qualifications added yet."}</T></p>
          ) : (
            <ul className="flex flex-col gap-3">
              {education.slice(0, 3).map((e) => (
                <li key={e.id}>
                  <p className="font-medium">
                    {e.qualification_name || catalogues.qualificationTypes.find((q) => q.id === e.qualification_type_id)?.name}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {catalogues.institutions.find((i) => i.id === e.institution_id)?.name ?? e.institution_name_other} · {e.start_year}–
                    {e.end_year ?? <T>{"present"}</T>} · <T>{ACADEMIC_STATUS_LABELS[e.academic_status]}</T>
                  </p>
                </li>
              ))}
              {education.length > 3 && <li className="text-sm text-ink-muted">+ {education.length - 3}{" "}<T>{"more"}</T></li>}
            </ul>
          )}
        </Card>

        <Card title="Experience" action={editLink("/dashboard/experience")}>
          {experiences.length === 0 ? (
            <p className="text-ink-muted"><T>{"No experience added yet. Internships, volunteering and projects all count."}</T></p>
          ) : (
            <ul className="flex flex-col gap-3">
              {experiences.slice(0, 3).map((x) => (
                <li key={x.id}>
                  <p className="font-medium">{x.role_title}</p>
                  <p className="text-sm text-ink-muted">
                    {x.organisation} · <T>{EXPERIENCE_LABELS[x.experience_type]}</T>
                    {x.is_current ? <> · <T>{"Current"}</T></> : ""}
                  </p>
                </li>
              ))}
              {experiences.length > 3 && <li className="text-sm text-ink-muted">+ {experiences.length - 3}{" "}<T>{"more"}</T></li>}
            </ul>
          )}
        </Card>

        <Card title="Documents" action={editLink("/dashboard/documents", "Manage")}>
          <ul className="flex flex-col gap-2">
            {(["cv", "transcript"] as DocumentType[]).map((t) => (
              <li key={t} className="flex items-center justify-between gap-3">
                <span className="text-[15px]"><T>{DOCUMENT_TYPE_LABELS[t]}</T></span>
                {docTypes.has(t) ? <Badge tone="success"><T>{"Uploaded"}</T></Badge> : <Badge tone="warning"><T>{"Missing"}</T></Badge>}
              </li>
            ))}
            <li className="flex items-center justify-between gap-3">
              <span className="text-[15px]"><T>{"Certificates and other documents"}</T></span>
              <span className="text-sm text-ink-muted">
                {documents.filter((d) => !["cv", "transcript"].includes(d.document_type)).length}
              </span>
            </li>
          </ul>
        </Card>

        <Card title="Skills" action={editLink("/dashboard/skills")}>
          {skills.length === 0 ? (
            <p className="text-ink-muted"><T>{"No skills added yet."}</T></p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {skills.slice(0, 10).map((k) => (
                <li key={k.id}><Badge tone="indigo">{skillName(k.skill_id, k.custom_skill_name)}</Badge></li>
              ))}
              {skills.length > 10 && <li className="self-center text-sm text-ink-muted">+ {skills.length - 10}{" "}<T>{"more"}</T></li>}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Notifications">
        {notifications.length === 0 ? (
          <p className="text-ink-muted"><T>{"No notifications yet. Updates about your profile and verification will appear here."}</T></p>
        ) : (
          <ul className="divide-y divide-line">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className={n.read_at ? "text-[15px]" : "text-[15px] font-semibold"}><T>{n.title}</T></p>
                  {n.body && <p className="text-sm text-ink-muted"><T>{n.body}</T></p>}
                </div>
                <span className="shrink-0 text-sm text-ink-muted">{dateLabel(n.created_at, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {completion && completion.total < 100 && (
        <div className="flex justify-end">
          <ButtonLink href={tasks[0]?.href ?? "/dashboard/profile"}><T>{"Continue improving my profile"}</T></ButtonLink>
        </div>
      )}
    </div>
  );
}
