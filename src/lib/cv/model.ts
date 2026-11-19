/**
 * The CV as plain data, built from the student's profile. Shared by the PDF
 * renderer and the on-screen preview so both always show the same content.
 */

export type CvLocale = "pt" | "en";

export type CvEntry = {
  title: string;
  subtitle: string | null;
  period: string | null;
  body: string | null;
};

export type CvData = {
  name: string;
  headline: string | null;
  contact: string[];
  summary: string | null;
  education: CvEntry[];
  experience: CvEntry[];
  skills: string[];
  languages: string[];
};

export const CV_HEADINGS: Record<CvLocale, Record<"profile" | "education" | "experience" | "skills" | "languages" | "present", string>> = {
  pt: {
    profile: "Perfil",
    education: "Formação académica",
    experience: "Experiência",
    skills: "Competências",
    languages: "Línguas",
    present: "presente",
  },
  en: {
    profile: "Profile",
    education: "Education",
    experience: "Experience",
    skills: "Skills",
    languages: "Languages",
    present: "present",
  },
};

const MONTHS: Record<CvLocale, string[]> = {
  pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/** "2024-03-01" → "mar 2024" / "Mar 2024". */
export function monthYear(date: string | null, locale: CvLocale): string | null {
  if (!date) return null;
  const [y, m] = date.split("-").map(Number);
  if (!y || !m) return null;
  return `${MONTHS[locale][m - 1]} ${y}`;
}

export function period(from: string | null, to: string | null, current: boolean, locale: CvLocale): string | null {
  const start = from;
  const end = current ? CV_HEADINGS[locale].present : to;
  if (!start && !end) return null;
  if (!end) return start;
  if (!start) return end;
  return start === end ? start : `${start} – ${end}`;
}

/** What a CV needs before it is worth downloading. Codes match the profile sections. */
export function cvGaps(cv: CvData): ("name" | "headline" | "education" | "experience" | "skills")[] {
  const gaps: ("name" | "headline" | "education" | "experience" | "skills")[] = [];
  if (!cv.name.trim()) gaps.push("name");
  if (!cv.headline) gaps.push("headline");
  if (cv.education.length === 0) gaps.push("education");
  if (cv.experience.length === 0) gaps.push("experience");
  if (cv.skills.length === 0) gaps.push("skills");
  return gaps;
}

/** A safe file name: "CV-Amina-Macuacua.pdf". */
export function cvFileName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `CV-${slug || "Handson"}.pdf`;
}
