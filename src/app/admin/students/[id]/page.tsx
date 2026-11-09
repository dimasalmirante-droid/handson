import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AccountControls, StatusBadge, VerifyControls } from "@/components/admin/controls";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Progress } from "@/components/ui/feedback";
import { requireAdmin, roleAtLeast } from "@/lib/auth/admin";
import { countryOptions } from "@/lib/countries";
import { logProfileView } from "@/lib/data/admin";
import { getCatalogues } from "@/lib/data/catalogues";
import {
  MISSING_LABELS,
  getCompletion,
  getConsentHistory,
  getDocuments,
  getEducation,
  getExperiences,
  getInterests,
  getPhotoUrl,
  getProfile,
  getSkills,
} from "@/lib/data/student";
import { DOCUMENT_TYPE_LABELS, formatBytes, type DocumentType } from "@/lib/files";
import {
  ACADEMIC_STATUS_LABELS,
  ARRANGEMENT_LABELS,
  AVAILABILITY_LABELS,
  EXPERIENCE_LABELS,
  INSTITUTION_TYPE_LABELS,
  PROFICIENCY_LABELS,
  SECTION_LABELS,
} from "@/lib/onboarding/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Student profile" };

const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const dt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Maputo" });

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-line bg-surface-raised p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-[15px]">{children || <span className="text-ink-muted">—</span>}</dd>
    </>
  );
}

export default async function StudentReviewPage({ params }: PageProps<"/admin/students/[id]">) {
  const { role } = await requireAdmin("reviewer");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const profile = await getProfile(id);
  if (!profile) notFound();
  await logProfileView(id);

  const supabase = await createClient();
  const [completion, education, skills, interests, experiences, documents, consents, catalogues, photoUrl, statusRow, audit] = await Promise.all([
    getCompletion(id),
    getEducation(id),
    getSkills(id),
    getInterests(id),
    getExperiences(id),
    getDocuments(id),
    getConsentHistory(id),
    getCatalogues(),
    getPhotoUrl(profile.photo_path),
    supabase.from("profiles").select("account_status, created_at, verified_at").eq("id", id).single(),
    roleAtLeast(role, "super_admin")
      ? supabase.rpc("admin_audit_log", { p_target: id, p_limit: 20, p_offset: 0 })
      : Promise.resolve({ data: null }),
  ]);

  const countries = countryOptions("en");
  const country = (c: string | null) => [...countries.priority, ...countries.rest].find((x) => x.code === c)?.name ?? c;
  const province = catalogues.provinces.find((p) => p.id === profile.province_id)?.name;
  const names = (ids: number[], list: { id: number; name: string }[]) => ids.map((x) => list.find((l) => l.id === x)?.name).filter(Boolean).join(", ");
  const fullName = [profile.first_name, profile.middle_name, profile.surname].filter(Boolean).join(" ") || "Name not added";
  const accountStatus = (statusRow.data?.account_status as string) ?? "active";
  const auditRows = (audit.data ?? []) as { id: number; created_at: string; actor_email: string | null; action: string; metadata: Record<string, unknown> }[];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/students" className="text-sm font-semibold text-indigo hover:underline">← All students</Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="size-16 shrink-0 overflow-hidden rounded-full bg-lime">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
              <img src={photoUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center font-display text-xl font-bold" aria-hidden>
                {`${profile.first_name?.[0] ?? ""}${profile.surname?.[0] ?? ""}`.toUpperCase() || "?"}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-[clamp(26px,4vw,34px)] tracking-[-0.03em]">{fullName}</h1>
            <p className="text-ink-muted">{profile.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge status={profile.verification_status} />
              {profile.employer_visibility ? <Badge tone="lime">Visible to employers</Badge> : <Badge>Private</Badge>}
              {accountStatus === "suspended" && <Badge tone="danger">Suspended</Badge>}
              {!profile.onboarding_completed_at && <Badge tone="warning">Onboarding not finished</Badge>}
            </div>
          </div>
        </div>
        <p className="text-sm text-ink-muted">Registered {d(statusRow.data?.created_at ?? null)}</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Profile verification">
          <VerifyControls target={{ kind: "profile", profileId: id }} current={profile.verification_status} />
          {statusRow.data?.verified_at && <p className="mt-3 text-sm text-ink-muted">Verified on {d(statusRow.data.verified_at)}</p>}
        </Panel>
        <Panel title="Completion">
          <Progress value={completion?.total ?? 0} label="Profile completion" />
          {completion && (
            <ul className="mt-4 flex flex-col gap-1 text-sm">
              {Object.entries(completion.sections).map(([k, s]) => (
                <li key={k} className="flex justify-between gap-3">
                  <span>{SECTION_LABELS[k].title}</span>
                  <span className={s.score >= s.weight ? "text-success" : "text-warning"}>
                    {Math.round(s.score)}/{s.weight}%{s.missing.length ? ` · ${s.missing.map((m) => MISSING_LABELS[m] ?? m).join(", ")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Personal information">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[180px_1fr]">
          <Row label="Date of birth">{profile.date_of_birth ? d(profile.date_of_birth) : null}</Row>
          <Row label="Gender">{profile.gender?.replaceAll("_", " ")}</Row>
          <Row label="Nationality">{country(profile.nationality_code)}</Row>
          <Row label="Location">{[profile.city, province, country(profile.country_code)].filter(Boolean).join(", ")}</Row>
          <Row label="Phone">{profile.phone}</Row>
          <Row label="LinkedIn">{profile.linkedin_url && <a className="text-indigo hover:underline" href={profile.linkedin_url} target="_blank" rel="noopener noreferrer">{profile.linkedin_url}</a>}</Row>
          <Row label="GitHub">{profile.github_url && <a className="text-indigo hover:underline" href={profile.github_url} target="_blank" rel="noopener noreferrer">{profile.github_url}</a>}</Row>
          <Row label="Portfolio">{profile.portfolio_url && <a className="text-indigo hover:underline" href={profile.portfolio_url} target="_blank" rel="noopener noreferrer">{profile.portfolio_url}</a>}</Row>
        </dl>
      </Panel>

      <Panel title={`Education (${education.length})`}>
        {education.length === 0 ? (
          <p className="text-ink-muted">No qualifications added.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {education.map((e) => (
              <li key={e.id} className="rounded-[14px] border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{e.qualification_name || catalogues.qualificationTypes.find((q) => q.id === e.qualification_type_id)?.name}</p>
                    <p className="text-[15px] text-ink-muted">
                      {catalogues.institutions.find((i) => i.id === e.institution_id)?.name ?? `${e.institution_name_other} (not in catalogue)`} ·{" "}
                      {INSTITUTION_TYPE_LABELS[e.institution_type]}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {[
                        e.field_of_study_other || catalogues.fieldsOfStudy.find((f) => f.id === e.field_of_study_id)?.name,
                        `${e.start_year}–${e.end_year ?? "present"}`,
                        ACADEMIC_STATUS_LABELS[e.academic_status],
                        e.year_of_study ? `Year ${e.year_of_study}` : null,
                        e.grade !== null ? `Grade ${e.grade}/${e.grade_scale}` : null,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <StatusBadge status={e.verification_status} />
                </div>
                <div className="mt-3">
                  <VerifyControls compact target={{ kind: "education_records", id: e.id, profileId: id }} current={e.verification_status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Documents (${documents.length})`}>
        {documents.length === 0 ? (
          <p className="text-ink-muted">No documents uploaded.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {documents.map((doc) => (
              <li key={doc.id} className="rounded-[14px] border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{DOCUMENT_TYPE_LABELS[doc.document_type as DocumentType] ?? doc.title}</p>
                    <p className="truncate text-[15px] text-ink-muted">{doc.original_filename}</p>
                    <p className="text-sm text-ink-muted">{formatBytes(doc.size_bytes)} · uploaded {d(doc.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={doc.verification_status} />
                    <a href={`/files/${doc.id}`} target="_blank" rel="noopener" className={buttonClasses({ variant: "secondary", size: "sm" })}>Open</a>
                  </div>
                </div>
                <div className="mt-3">
                  <VerifyControls compact target={{ kind: "documents", id: doc.id, profileId: id }} current={doc.verification_status} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-ink-muted">Opening a document is recorded in the audit log.</p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`Skills (${skills.length})`}>
          {skills.length === 0 ? (
            <p className="text-ink-muted">No skills added.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <li key={s.id}>
                  <Badge tone="indigo">
                    {s.custom_skill_name ? `${s.custom_skill_name} (custom)` : catalogues.skills.find((k) => k.id === s.skill_id)?.name} · {PROFICIENCY_LABELS[s.proficiency]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Professional interests">
          {!interests ? (
            <p className="text-ink-muted">Not completed.</p>
          ) : (
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[140px_1fr]">
              <Row label="Industries">{names(interests.industryIds, catalogues.industries)}</Row>
              <Row label="Functions">{names(interests.jobFunctionIds, catalogues.jobFunctions)}</Row>
              <Row label="Roles">{interests.preferred_roles.join(", ")}</Row>
              <Row label="Locations">{names(interests.provinceIds, catalogues.provinces)}</Row>
              <Row label="Arrangement">{interests.work_arrangements.map((w) => ARRANGEMENT_LABELS[w]).join(", ")}</Row>
              <Row label="Available">
                {interests.availability ? AVAILABILITY_LABELS[interests.availability] : null}
                {interests.available_from ? ` (${d(interests.available_from)})` : ""}
              </Row>
              <Row label="Relocate">{interests.willing_to_relocate === null ? null : interests.willing_to_relocate ? "Yes" : "No"}</Row>
              <Row label="Goals">{interests.career_interests}</Row>
            </dl>
          )}
        </Panel>
      </div>

      <Panel title={`Experience (${experiences.length})`}>
        {experiences.length === 0 ? (
          <p className="text-ink-muted">No experience added.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {experiences.map((x) => (
              <li key={x.id}>
                <p className="font-semibold">{x.role_title} · {x.organisation}</p>
                <p className="text-sm text-ink-muted">
                  {EXPERIENCE_LABELS[x.experience_type]} · {d(x.start_date)} – {x.is_current ? "present" : d(x.end_date)}
                  {x.location ? ` · ${x.location}` : ""}
                </p>
                {x.description && <p className="mt-1 whitespace-pre-line text-[15px]">{x.description}</p>}
                {x.achievements && <p className="mt-1 whitespace-pre-line text-[15px] text-ink-muted">{x.achievements}</p>}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Account">
          {roleAtLeast(role, "admin") ? (
            <AccountControls profileId={id} status={accountStatus} />
          ) : (
            <p className="text-[15px]">
              {accountStatus === "suspended" ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>}{" "}
              <span className="text-ink-muted">Only administrators can suspend or reactivate accounts.</span>
            </p>
          )}
        </Panel>

        <Panel title="Consent history">
          {consents.length === 0 ? (
            <p className="text-ink-muted">No consent records.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {consents.slice(0, 10).map((c) => (
                <li key={c.id} className="flex justify-between gap-3">
                  <span>{c.consent_type.replaceAll("_", " ")} · {c.granted ? "agreed" : "withdrawn"}</span>
                  <span className="text-ink-muted">{dt(c.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {roleAtLeast(role, "super_admin") && (
        <Panel title="Audit trail" action={<Link href={`/admin/audit?target=${id}`} className="text-sm font-semibold text-indigo hover:underline">Full history</Link>}>
          {auditRows.length === 0 ? (
            <p className="text-ink-muted">No administrator actions recorded.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {auditRows.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-3">
                  <span>
                    <strong className="font-semibold">{a.action}</strong> by {a.actor_email ?? "system"}
                  </span>
                  <span className="text-ink-muted">{dt(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
