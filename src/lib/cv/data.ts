import "server-only";
import { countryOptions, splitPhone } from "@/lib/countries";
import { getCatalogues } from "@/lib/data/catalogues";
import { getCompletions } from "@/lib/data/learning";
import { getEducation, getExperiences, getLanguages, getProfile, getSkills } from "@/lib/data/student";
import { monthYear, period, type CvData, type CvEntry, type CvLocale } from "./model";

const STATUS: Record<CvLocale, Record<string, string>> = {
  pt: { enrolled: "Em curso", graduated: "Concluído", deferred: "Interrompido", discontinued: "Não concluído" },
  en: { enrolled: "In progress", graduated: "Completed", deferred: "Paused", discontinued: "Not completed" },
};

const EXPERIENCE: Record<CvLocale, Record<string, string>> = {
  pt: {
    internship: "Estágio",
    part_time: "Tempo parcial",
    full_time: "Tempo inteiro",
    volunteering: "Voluntariado",
    university_project: "Projecto académico",
    extracurricular: "Actividade extracurricular",
    freelance: "Trabalho independente",
    other: "Outro",
  },
  en: {
    internship: "Internship",
    part_time: "Part-time",
    full_time: "Full-time",
    volunteering: "Volunteering",
    university_project: "Academic project",
    extracurricular: "Extracurricular activity",
    freelance: "Freelance",
    other: "Other",
  },
};

const PROFICIENCY: Record<CvLocale, Record<string, string>> = {
  pt: { beginner: "iniciante", intermediate: "intermédio", advanced: "avançado", expert: "especialista" },
  en: { beginner: "beginner", intermediate: "intermediate", advanced: "advanced", expert: "expert" },
};

const LANGUAGE_LEVEL: Record<CvLocale, Record<string, string>> = {
  pt: { basic: "básico", intermediate: "intermédio", advanced: "avançado", fluent: "fluente", native: "nativo" },
  en: { basic: "basic", intermediate: "intermediate", advanced: "advanced", fluent: "fluent", native: "native" },
};

const YEAR_OF_STUDY: Record<CvLocale, (n: number) => string> = {
  pt: (n) => `${n}.º ano`,
  en: (n) => `Year ${n}`,
};

/** "+258841234567" → "+258 84 123 4567". */
function formatPhone(e164: string | null): string | null {
  if (!e164) return null;
  const { dial, national } = splitPhone(e164);
  if (dial === "+258" && national.length === 9) return `${dial} ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
  return `${dial} ${national}`;
}

/** Build the CV for the signed-in student from their saved profile. */
export async function loadCv(userId: string, locale: CvLocale): Promise<CvData | null> {
  const [profile, education, experiences, skills, languages, catalogues, completions] = await Promise.all([
    getProfile(userId),
    getEducation(userId),
    getExperiences(userId),
    getSkills(userId),
    getLanguages(userId),
    getCatalogues(locale),
    getCompletions(userId),
  ]);
  if (!profile) return null;

  const province = catalogues.provinces.find((p) => p.id === profile.province_id)?.name ?? null;
  const district = catalogues.districts.find((d) => d.id === profile.district_id)?.name ?? null;
  const countries = countryOptions(locale);
  const country =
    profile.country_code === "MZ" ? null : [...countries.priority, ...countries.rest].find((c) => c.code === profile.country_code)?.name;
  const location = [district ?? profile.city, province, country].filter(Boolean).join(", ");

  const contact = [
    profile.email,
    formatPhone(profile.phone),
    location || null,
    profile.linkedin_url ? profile.linkedin_url.replace(/^https?:\/\/(www\.)?/, "") : null,
  ].filter((c): c is string => !!c);

  const educationEntries: CvEntry[] = education.map((e) => {
    const qualification = e.qualification_name || catalogues.qualificationTypes.find((q) => q.id === e.qualification_type_id)?.name || "";
    const field = catalogues.fieldsOfStudy.find((f) => f.id === e.field_of_study_id)?.name ?? e.field_of_study_other;
    const institution = catalogues.institutions.find((i) => i.id === e.institution_id)?.name ?? e.institution_name_other;
    const connector = locale === "pt" ? "em" : "in";
    const status = [
      e.academic_status !== "graduated" ? STATUS[locale][e.academic_status] : null,
      e.academic_status === "enrolled" && e.year_of_study ? YEAR_OF_STUDY[locale](e.year_of_study) : null,
      e.grade !== null ? `${locale === "pt" ? "Média" : "Grade"}: ${e.grade}/${e.grade_scale}` : null,
    ].filter(Boolean);
    return {
      title: field && !qualification.toLowerCase().includes(field.toLowerCase()) ? `${qualification} ${connector} ${field}` : qualification,
      subtitle: institution ?? null,
      period: period(String(e.start_year), e.end_year ? String(e.end_year) : null, e.academic_status === "enrolled" && !e.end_year, locale),
      body: status.length ? status.join(" · ") : null,
    };
  });

  const experienceEntries: CvEntry[] = experiences.map((x) => ({
    title: x.role_title,
    subtitle: [x.organisation, EXPERIENCE[locale][x.experience_type], x.location].filter(Boolean).join(" · "),
    period: period(monthYear(x.start_date, locale), monthYear(x.end_date, locale), x.is_current, locale),
    body: [x.description, x.achievements].filter(Boolean).join("\n") || null,
  }));

  const skillNames = skills.map((k) => {
    const name = k.custom_skill_name ?? catalogues.skills.find((c) => c.id === k.skill_id)?.name ?? "";
    return `${name} (${PROFICIENCY[locale][k.proficiency] ?? k.proficiency})`;
  });

  const languageNames = languages.map((l) => {
    const name = catalogues.languages.find((c) => c.id === l.language_id)?.name ?? "";
    return `${name} (${LANGUAGE_LEVEL[locale][l.level] ?? l.level})`;
  });

  return {
    name: [profile.first_name, profile.middle_name, profile.surname].filter(Boolean).join(" "),
    headline: profile.headline,
    contact,
    summary: profile.summary,
    education: educationEntries,
    experience: experienceEntries,
    skills: skillNames.filter((s) => !s.startsWith(" (")),
    languages: languageNames.filter((s) => !s.startsWith(" (")),
    training: completions.map((c) => ({
      title: c.badge_name ?? c.title,
      subtitle: "Handson",
      period: monthYear(c.completed_at.slice(0, 10), locale),
      body: null,
    })),
  };
}
