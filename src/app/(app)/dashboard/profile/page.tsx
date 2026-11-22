import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { EditPanel } from "@/components/dashboard/edit-panel";
import { PhotoUploader } from "@/components/files/photo-uploader";
import { DocumentsStep } from "@/components/onboarding/documents-step";
import { EducationStep } from "@/components/onboarding/education-step";
import { ExperienceStep } from "@/components/onboarding/experience-step";
import { InterestsStep } from "@/components/onboarding/interests-step";
import { PersonalForm } from "@/components/onboarding/personal-form";
import { SkillsStep } from "@/components/onboarding/skills-step";
import { Badge } from "@/components/ui/feedback";
import { LOCALE_TAGS, type Locale } from "@/i18n/config";
import { getLocale, getT } from "@/i18n/server";
import type { TFunction } from "@/i18n/translate";
import { requireStudent } from "@/lib/auth/session";
import { countryOptions, splitPhone } from "@/lib/countries";
import { getCatalogues } from "@/lib/data/catalogues";
import {
  getDocuments,
  getEducation,
  getExperiences,
  getInterests,
  getLanguages,
  getPhotoUrl,
  getProfile,
  getSkills,
} from "@/lib/data/student";
import { PROFILE_SECTIONS, isProfileSection, profileEditHref, type ProfileSection } from "@/lib/dashboard/profile-sections";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/files";
import {
  ACADEMIC_STATUS_LABELS,
  ARRANGEMENT_LABELS,
  AVAILABILITY_LABELS,
  EXPERIENCE_LABELS,
  LANGUAGE_LEVEL_LABELS,
  PROFICIENCY_LABELS,
} from "@/lib/onboarding/labels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("My profile") };
}

/** "Jan 2026" / "jan 2026". Month and year are formatted separately because some locales (pt-MZ) render month+year numerically. */
const monthYear = (d: string | null, locale: Locale) => {
  if (!d) return "";
  const date = new Date(`${d}T00:00:00`);
  const month = date.toLocaleDateString(LOCALE_TAGS[locale], { month: "short" }).replace(".", "");
  return `${month} ${date.getFullYear()}`;
};

/** One section of the read view: a heading, an Edit link, and either content or an invitation. */
function Section({
  id,
  title,
  edit,
  t,
  empty,
  children,
}: {
  id: ProfileSection;
  title: string;
  edit: string;
  t: TFunction;
  empty?: { text: string; action: string } | false;
  children?: ReactNode;
}) {
  const isEmpty = !!empty;
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={
        isEmpty
          ? "rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface-raised p-5 sm:p-6"
          : "rounded-[var(--radius-lg)] border border-line bg-surface-raised p-5 sm:p-6"
      }
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={`${id}-title`} className="text-lg">{t(title)}</h2>
        {!isEmpty && (
          <Link href={edit} scroll={false} className="text-sm font-semibold text-indigo hover:underline" aria-label={`${t("Edit")}: ${t(title)}`}>
            {t("Edit")}
          </Link>
        )}
      </div>
      {isEmpty ? (
        <>
          <p className="mt-1 text-[15px] text-ink-muted">{t(empty.text)}</p>
          <Link
            href={edit}
            scroll={false}
            className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface-raised px-4 py-2 text-[15px] font-semibold ring-1 ring-inset ring-line-strong hover:bg-indigo-soft hover:text-indigo"
          >
            <span aria-hidden>+</span> {t(empty.action)}
          </Link>
        </>
      ) : (
        <div className="mt-3">{children}</div>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-[15px]">{children || "—"}</dd>
    </div>
  );
}

export default async function ProfilePage({ searchParams }: PageProps<"/dashboard/profile">) {
  const user = await requireStudent("/dashboard/profile");
  const [profile, education, experiences, skills, languages, interests, documents, catalogues, sp, locale, t] = await Promise.all([
    getProfile(user.id),
    getEducation(user.id),
    getExperiences(user.id),
    getSkills(user.id),
    getLanguages(user.id),
    getInterests(user.id),
    getDocuments(user.id),
    getCatalogues(),
    searchParams,
    getLocale(),
    getT(),
  ]);
  const photoUrl = await getPhotoUrl(profile?.photo_path ?? null);
  const initials = `${profile?.first_name?.[0] ?? ""}${profile?.surname?.[0] ?? ""}`.toUpperCase() || "?";
  const editing = typeof sp.edit === "string" && isProfileSection(sp.edit) ? sp.edit : null;

  const countries = countryOptions(locale);
  const countryName = (code: string | null) => [...countries.priority, ...countries.rest].find((c) => c.code === code)?.name ?? code ?? "";
  const province = catalogues.provinces.find((p) => p.id === profile?.province_id)?.name;
  const district = catalogues.districts.find((d) => d.id === profile?.district_id)?.name;
  const location = [district ?? profile?.city, province, profile?.country_code !== "MZ" ? countryName(profile?.country_code ?? null) : null]
    .filter(Boolean)
    .join(", ");
  const name = [profile?.first_name, profile?.middle_name, profile?.surname].filter(Boolean).join(" ");
  const names = (ids: number[], list: { id: number; name: string }[]) =>
    ids.map((id) => list.find((x) => x.id === id)?.name).filter(Boolean).join(", ");

  const dob = profile?.date_of_birth
    ? new Date(`${profile.date_of_birth}T00:00:00`).toLocaleDateString(LOCALE_TAGS[locale], { day: "numeric", month: "long", year: "numeric" })
    : "";
  const docCount = (type: DocumentType) => documents.filter((d) => d.document_type === type).length;
  const hasPreferences =
    !!interests &&
    (interests.industryIds.length > 0 || interests.jobFunctionIds.length > 0 || interests.provinceIds.length > 0 || !!interests.availability);

  const phone = splitPhone(profile?.phone);
  const personalInitial: Record<string, string> = {
    firstName: profile?.first_name ?? "",
    middleName: profile?.middle_name ?? "",
    surname: profile?.surname ?? "",
    dateOfBirth: profile?.date_of_birth ?? "",
    gender: profile?.gender ?? "",
    nationality: profile?.nationality_code ?? "",
    country: profile?.country_code ?? "MZ",
    provinceId: profile?.province_id ? String(profile.province_id) : "",
    districtId: profile?.district_id ? String(profile.district_id) : profile?.city && (profile?.country_code ?? "MZ") === "MZ" ? "other" : "",
    city: profile?.city ?? "",
    headline: profile?.headline ?? "",
    summary: profile?.summary ?? "",
    phoneDial: phone.dial,
    phoneNumber: phone.national,
    linkedinUrl: profile?.linkedin_url ?? "",
  };

  const panel: Record<ProfileSection, () => ReactNode> = {
    about: () => (
      <PersonalForm
        embedded
        photo={<PhotoUploader photoUrl={photoUrl} initials={initials} />}
        initial={personalInitial}
        countries={countries}
        provinces={catalogues.provinces}
        districts={catalogues.districts}
      />
    ),
    education: () => (
      <EducationStep
        embedded
        userId={user.id}
        records={education}
        catalogues={{ institutions: catalogues.institutions, qualificationTypes: catalogues.qualificationTypes, fieldsOfStudy: catalogues.fieldsOfStudy }}
      />
    ),
    experience: () => <ExperienceStep embedded userId={user.id} records={experiences} />,
    skills: () => (
      <SkillsStep
        embedded
        mine={skills}
        skills={catalogues.skills}
        categories={catalogues.skillCategories}
        myLanguages={languages}
        languages={catalogues.languages}
      />
    ),
    preferences: () => (
      <InterestsStep
        embedded
        initial={interests}
        industries={catalogues.industries}
        jobFunctions={catalogues.jobFunctions}
        provinces={catalogues.provinces}
      />
    ),
    documents: () => (
      <DocumentsStep
        embedded
        initial={{ linkedinUrl: profile?.linkedin_url ?? "", githubUrl: profile?.github_url ?? "", portfolioUrl: profile?.portfolio_url ?? "" }}
        documents={documents}
      />
    ),
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <section aria-labelledby="profile-name" className="rounded-[var(--radius-lg)] border border-line bg-surface-raised p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="size-20 shrink-0 overflow-hidden rounded-full bg-lime">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
              <img src={photoUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center font-display text-2xl font-bold" aria-hidden>{initials}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 id="profile-name" className="text-[clamp(24px,3vw,30px)] tracking-[-0.03em]">{name || t("Your name")}</h1>
              {profile?.verification_status === "verified" && <Badge tone="success">Verified</Badge>}
            </div>
            {profile?.headline ? (
              <p className="mt-0.5 text-[17px] font-medium text-indigo">{profile.headline}</p>
            ) : (
              <Link href={profileEditHref("about")} scroll={false} className="mt-0.5 inline-block text-[15px] font-semibold text-indigo hover:underline">
                + {t("Add a professional headline")}
              </Link>
            )}
            {location && <p className="mt-0.5 text-[15px] text-ink-muted">{location}</p>}
          </div>
          <Link
            href={profileEditHref("about")}
            scroll={false}
            className="self-start rounded-[var(--radius-pill)] px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-line-strong hover:bg-indigo-soft hover:text-indigo"
          >
            {t("Edit")}
          </Link>
        </div>
        {profile?.summary && <p className="mt-5 whitespace-pre-line border-t border-line pt-4 text-[15px]">{profile.summary}</p>}
        <dl className="mt-4 divide-y divide-line border-t border-line">
          <Row label={t("Phone number")}>{profile?.phone ? `${phone.dial} ${phone.national.replace(/^(\d{2})(\d{3})(\d{4})$/, "$1 $2 $3")}` : ""}</Row>
          <Row label={t("Email address")}>{profile?.email}</Row>
          <Row label={t("Date of birth")}>{dob}</Row>
          <Row label={t("Nationality")}>{countryName(profile?.nationality_code ?? null)}</Row>
        </dl>
        <p className="mt-3 text-sm text-ink-muted">{t("Your phone number, email, date of birth and documents are not shown until you choose to share them.")}</p>
      </section>

      <Section
        id="education"
        title="Education"
        edit={profileEditHref("education")}
        t={t}
        empty={education.length === 0 && { text: "Employers look at education first. It takes about two minutes.", action: "Add qualification" }}
      >
        <ul className="flex flex-col gap-4">
          {education.map((e) => {
            const qualification = e.qualification_name || catalogues.qualificationTypes.find((q) => q.id === e.qualification_type_id)?.name;
            const field = catalogues.fieldsOfStudy.find((f) => f.id === e.field_of_study_id)?.name ?? e.field_of_study_other;
            const institution = catalogues.institutions.find((i) => i.id === e.institution_id)?.name ?? e.institution_name_other;
            return (
              <li key={e.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="font-semibold">
                    {qualification}
                    {field && !qualification?.toLowerCase().includes(field.toLowerCase()) ? ` · ${field}` : ""}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {e.start_year} – {e.end_year ?? t("present")}
                  </p>
                </div>
                <p className="text-[15px] text-ink-muted">
                  {[institution, e.academic_status !== "graduated" ? t(ACADEMIC_STATUS_LABELS[e.academic_status]) : null].filter(Boolean).join(" · ")}
                  {e.verification_status === "verified" && <> · <span className="text-success">✓ {t("Verified")}</span></>}
                  {e.verification_status === "rejected" && <> · <span className="text-danger">{t("Needs changes")}</span></>}
                </p>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section
        id="experience"
        title="Experience"
        edit={profileEditHref("experience")}
        t={t}
        empty={experiences.length === 0 && { text: "Internships, volunteering, projects and student activities all count.", action: "Add experience" }}
      >
        <ul className="flex flex-col gap-4">
          {experiences.map((x) => (
            <li key={x.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="font-semibold">{x.role_title}</p>
                <p className="text-sm text-ink-muted">
                  {monthYear(x.start_date, locale)} – {x.is_current ? t("present") : monthYear(x.end_date, locale)}
                </p>
              </div>
              <p className="text-[15px] text-ink-muted">{[x.organisation, t(EXPERIENCE_LABELS[x.experience_type] ?? ""), x.location].filter(Boolean).join(" · ")}</p>
              {x.description && <p className="mt-1 line-clamp-3 whitespace-pre-line text-[15px]">{x.description}</p>}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="skills"
        title="Skills and languages"
        edit={profileEditHref("skills")}
        t={t}
        empty={skills.length === 0 && languages.length === 0 && { text: "Include software, languages and professional skills you can offer.", action: "Add skills" }}
      >
        {skills.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {skills.map((k) => (
              <li key={k.id} className="rounded-[var(--radius-pill)] bg-surface px-3 py-1.5 text-[15px] ring-1 ring-inset ring-line">
                {k.custom_skill_name ?? catalogues.skills.find((s) => s.id === k.skill_id)?.name}
                <span className="text-ink-muted"> · {t(PROFICIENCY_LABELS[k.proficiency] ?? k.proficiency)}</span>
              </li>
            ))}
          </ul>
        )}
        {languages.length > 0 && (
          <p className={skills.length > 0 ? "mt-4 text-[15px]" : "text-[15px]"}>
            <span className="text-ink-muted">{t("Languages")}: </span>
            {languages
              .map((l) => `${catalogues.languages.find((c) => c.id === l.language_id)?.name ?? ""} (${t(LANGUAGE_LEVEL_LABELS[l.level] ?? l.level).toLowerCase()})`)
              .join(" · ")}
          </p>
        )}
        {skills.length > 0 && skills.length < 3 && (
          <p className="mt-3 text-sm text-ink-muted">{t("add at least {n} more", { n: 3 - skills.length })}</p>
        )}
      </Section>

      <Section
        id="preferences"
        title="What you are looking for"
        edit={profileEditHref("preferences")}
        t={t}
        empty={!hasPreferences && { text: "Choose the industries, roles and places that interest you.", action: "Choose preferences" }}
      >
        {interests && (
          <dl className="divide-y divide-line">
            <Row label={t("Industries")}>{names(interests.industryIds, catalogues.industries)}</Row>
            <Row label={t("Job functions")}>{names(interests.jobFunctionIds, catalogues.jobFunctions)}</Row>
            <Row label={t("Preferred locations")}>{names(interests.provinceIds, catalogues.provinces)}</Row>
            <Row label={t("Work arrangement")}>{interests.work_arrangements.map((w) => t(ARRANGEMENT_LABELS[w] ?? w)).join(", ")}</Row>
            <Row label={t("When you can start")}>{interests.availability ? t(AVAILABILITY_LABELS[interests.availability] ?? interests.availability) : ""}</Row>
          </dl>
        )}
      </Section>

      <Section id="documents" title="Documents and links" edit={profileEditHref("documents")} t={t}>
        <dl className="divide-y divide-line">
          {(["cv", "transcript"] as const).map((type) => (
            <Row key={type} label={t(DOCUMENT_TYPE_LABELS[type])}>
              {docCount(type) > 0 ? (
                <span className="text-success">✓ {t("Uploaded")}</span>
              ) : (
                <Link href={profileEditHref("documents")} scroll={false} className="font-semibold text-indigo hover:underline">
                  + {t("Upload")}
                </Link>
              )}
            </Row>
          ))}
          <Row label={t("Certificates and other documents")}>{String(docCount("certificate") + docCount("other"))}</Row>
          <Row label={t("Links")}>
            {[profile?.linkedin_url && "LinkedIn", profile?.github_url && "GitHub", profile?.portfolio_url && t("Portfolio")].filter(Boolean).join(" · ")}
          </Row>
        </dl>
      </Section>

      {editing && (
        <EditPanel title={PROFILE_SECTIONS[editing].title} closeHref={`/dashboard/profile#${editing}`} footer={editing !== "about"}>
          {panel[editing]()}
        </EditPanel>
      )}
    </div>
  );
}
