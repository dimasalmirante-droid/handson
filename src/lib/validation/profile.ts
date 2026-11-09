import { z } from "zod";
import { isCountryCode, toE164 } from "@/lib/countries";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

const CURRENT_YEAR = new Date().getFullYear();

/** Empty strings from forms become undefined. */
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opt = <T extends z.ZodType>(schema: T) => z.preprocess(blank, schema.optional());

const personName = z
  .string()
  .trim()
  .max(100, "Too long.")
  .regex(/^[\p{L}\p{M}' .-]+$/u, "Use letters only.");

export const httpsUrl = (host?: RegExp, label = "link") =>
  z
    .string()
    .trim()
    .max(300, "This link is too long.")
    .transform((v) => (/^https?:\/\//i.test(v) ? v.replace(/^http:\/\//i, "https://") : `https://${v}`))
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === "https:" && (!host || host.test(u.hostname));
      } catch {
        return false;
      }
    }, `Enter a valid ${label}.`);

const linkedinUrl = httpsUrl(/(^|\.)linkedin\.com$/i, "LinkedIn profile link (linkedin.com/in/…)");
const githubUrl = httpsUrl(/(^|\.)github\.com$/i, "GitHub profile link (github.com/…)");
const portfolioUrl = httpsUrl(undefined, "website address");

export type FieldErrors = Partial<Record<string, string>>;

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Step 1 · Personal information                                       */
/* ------------------------------------------------------------------ */

export const GENDERS = ["female", "male", "other", "prefer_not_to_say"] as const;

const personalBase = z.object({
  firstName: opt(personName),
  middleName: opt(personName),
  surname: opt(personName),
  dateOfBirth: opt(
    z.iso.date("Enter a valid date.").refine((d) => {
      const age = (Date.now() - new Date(d).getTime()) / (365.25 * 24 * 3600 * 1000);
      return age >= 14 && age <= 86;
    }, "Check your date of birth."),
  ),
  gender: opt(z.enum(GENDERS)),
  nationality: opt(z.string().refine(isCountryCode, "Select a country.")),
  country: opt(z.string().refine(isCountryCode, "Select a country.")),
  provinceId: opt(z.coerce.number().int().positive("Select a province.")),
  city: opt(z.string().trim().min(2, "Enter your city or district.").max(100, "Too long.")),
  phoneDial: opt(z.string().regex(/^\+\d{1,4}$/)),
  phoneNumber: opt(z.string().trim().max(20)),
  linkedinUrl: opt(linkedinUrl),
});

/** Validates format only; used for autosave of partially completed forms. */
export const personalDraftSchema = personalBase.transform((v, ctx) => {
  let phone: string | null | undefined;
  if (v.phoneNumber) {
    phone = toE164(v.phoneDial ?? "+258", v.phoneNumber);
    if (!phone) {
      ctx.addIssue({
        code: "custom",
        path: ["phoneNumber"],
        message: (v.phoneDial ?? "+258") === "+258"
          ? "Enter a 9-digit Mozambican mobile number, for example 84 123 4567."
          : "Enter a valid phone number.",
      });
      return z.NEVER;
    }
  }
  return { ...v, phone: phone ?? null };
});

/** Required fields for completing the step. */
export const personalRequiredSchema = personalDraftSchema.superRefine((v, ctx) => {
  const need = (key: keyof typeof v, message: string) => {
    if (v[key] === undefined || v[key] === null) ctx.addIssue({ code: "custom", path: [key], message });
  };
  need("firstName", "Enter your first name.");
  need("surname", "Enter your surname.");
  need("dateOfBirth", "Enter your date of birth.");
  need("nationality", "Select your nationality.");
  need("country", "Select the country where you live.");
  if ((v.country ?? "MZ") === "MZ") need("provinceId", "Select your province.");
  need("city", "Enter your city or district.");
  if (!v.phone) ctx.addIssue({ code: "custom", path: ["phoneNumber"], message: "Enter your phone number." });
});

export type PersonalInput = z.infer<typeof personalDraftSchema>;

/* ------------------------------------------------------------------ */
/* Step 2 · Education                                                  */
/* ------------------------------------------------------------------ */

export const INSTITUTION_TYPES = ["university", "polytechnic", "tvet", "secondary", "other"] as const;
export const ACADEMIC_STATUSES = ["enrolled", "graduated", "deferred", "discontinued"] as const;
export const LANGUAGES = ["pt", "en", "fr", "other"] as const;
export const GRADE_SCALES = [20, 10, 100, 5, 4] as const;

export const educationSchema = z
  .object({
    id: opt(z.uuid()),
    institutionId: opt(z.uuid()),
    institutionNameOther: opt(z.string().trim().min(2, "Enter the institution name.").max(200)),
    institutionType: z.enum(INSTITUTION_TYPES, { error: "Select the type of institution." }),
    qualificationTypeId: z.coerce.number({ error: "Select a qualification." }).int().positive("Select a qualification."),
    qualificationName: opt(z.string().trim().max(200)),
    fieldOfStudyId: opt(z.coerce.number().int().positive()),
    fieldOfStudyOther: opt(z.string().trim().min(2).max(150)),
    academicStatus: z.enum(ACADEMIC_STATUSES, { error: "Select your status." }),
    yearOfStudy: opt(z.coerce.number().int().min(1).max(8)),
    startYear: z.coerce
      .number({ error: "Enter the start year." })
      .int()
      .min(1960, "Check the year.")
      .max(CURRENT_YEAR + 1, "Check the year."),
    endYear: opt(z.coerce.number().int().min(1960, "Check the year.").max(CURRENT_YEAR + 10, "Check the year.")),
    grade: opt(z.coerce.number().min(0, "Grade cannot be negative.")),
    gradeScale: z.coerce.number().refine((n) => (GRADE_SCALES as readonly number[]).includes(n)).default(20),
    languageOfInstruction: opt(z.enum(LANGUAGES)),
  })
  .superRefine((v, ctx) => {
    if (!v.institutionId && !v.institutionNameOther)
      ctx.addIssue({ code: "custom", path: ["institutionId"], message: "Select your institution or enter its name." });
    if (!v.fieldOfStudyId && !v.fieldOfStudyOther)
      ctx.addIssue({ code: "custom", path: ["fieldOfStudyId"], message: "Select your field of study or enter it." });
    if (v.endYear !== undefined && v.endYear < v.startYear)
      ctx.addIssue({ code: "custom", path: ["endYear"], message: "Must be the same as or after the start year." });
    if (v.academicStatus === "graduated" && v.endYear === undefined)
      ctx.addIssue({ code: "custom", path: ["endYear"], message: "Enter your graduation year." });
    if (v.academicStatus === "graduated" && v.endYear !== undefined && v.endYear > CURRENT_YEAR)
      ctx.addIssue({ code: "custom", path: ["endYear"], message: "Graduation year cannot be in the future." });
    if (v.academicStatus === "enrolled" && v.endYear === undefined)
      ctx.addIssue({ code: "custom", path: ["endYear"], message: "Enter your expected graduation year." });
    if (v.grade !== undefined && v.grade > v.gradeScale)
      ctx.addIssue({ code: "custom", path: ["grade"], message: `Must be ${v.gradeScale} or less on this scale.` });
  });

export type EducationInput = z.infer<typeof educationSchema>;

/* ------------------------------------------------------------------ */
/* Step 3 · Skills                                                     */
/* ------------------------------------------------------------------ */

export const PROFICIENCY = ["beginner", "intermediate", "advanced", "expert"] as const;

export const addSkillSchema = z
  .object({
    skillId: z.number().int().positive().optional(),
    customName: z.string().trim().min(2, "Enter at least 2 characters.").max(80, "Too long.").optional(),
    proficiency: z.enum(PROFICIENCY),
  })
  .refine((v) => (v.skillId === undefined) !== (v.customName === undefined), { message: "Choose one skill." });

/* ------------------------------------------------------------------ */
/* Step 4 · Professional interests                                     */
/* ------------------------------------------------------------------ */

export const WORK_ARRANGEMENTS = ["on_site", "hybrid", "remote"] as const;
export const AVAILABILITY = ["immediately", "within_1_month", "within_3_months", "after_graduation", "specific_date"] as const;
export const DURATIONS = ["up_to_3_months", "3_to_6_months", "6_to_12_months", "over_12_months", "flexible"] as const;

const idList = z.array(z.number().int().positive()).max(30);

export const interestsSchema = z
  .object({
    industryIds: idList,
    jobFunctionIds: idList,
    provinceIds: idList,
    preferredRoles: z.array(z.string().trim().min(2).max(80)).max(5, "Add up to 5 roles."),
    careerInterests: z.string().trim().max(1000, "Keep this under 1,000 characters.").nullable(),
    workArrangements: z.array(z.enum(WORK_ARRANGEMENTS)).max(3),
    availability: z.enum(AVAILABILITY).nullable(),
    availableFrom: z.iso.date().nullable(),
    internshipDuration: z.enum(DURATIONS).nullable(),
    hasWorkExperience: z.boolean().nullable(),
    willingToRelocate: z.boolean().nullable(),
  })
  .refine((v) => v.availability !== "specific_date" || v.availableFrom !== null, {
    path: ["availableFrom"],
    message: "Choose the date you can start.",
  });

export type InterestsInput = z.infer<typeof interestsSchema>;

/* ------------------------------------------------------------------ */
/* Step 5 · Experience                                                 */
/* ------------------------------------------------------------------ */

export const EXPERIENCE_TYPES = [
  "internship", "part_time", "full_time", "volunteering", "university_project", "extracurricular", "freelance", "other",
] as const;

const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month and year.")
  .transform((m) => `${m}-01`);

export const experienceSchema = z
  .object({
    id: opt(z.uuid()),
    organisation: z.string().trim().min(2, "Enter the organisation.").max(200),
    roleTitle: z.string().trim().min(2, "Enter your role.").max(150),
    experienceType: z.enum(EXPERIENCE_TYPES, { error: "Select the type of experience." }),
    location: opt(z.string().trim().max(150)),
    startMonth: month,
    endMonth: opt(month),
    isCurrent: z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean()),
    description: opt(z.string().trim().max(2000, "Keep this under 2,000 characters.")),
    achievements: opt(z.string().trim().max(2000, "Keep this under 2,000 characters.")),
  })
  .superRefine((v, ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    if (v.startMonth > today) ctx.addIssue({ code: "custom", path: ["startMonth"], message: "Start date cannot be in the future." });
    if (!v.isCurrent && !v.endMonth)
      ctx.addIssue({ code: "custom", path: ["endMonth"], message: "Enter the end date, or tick “I currently do this”." });
    if (v.endMonth && v.endMonth < v.startMonth)
      ctx.addIssue({ code: "custom", path: ["endMonth"], message: "End date must be after the start date." });
  });

export type ExperienceInput = z.infer<typeof experienceSchema>;

/* ------------------------------------------------------------------ */
/* Step 6 · Portfolio links                                            */
/* ------------------------------------------------------------------ */

export const linksSchema = z.object({
  linkedinUrl: opt(linkedinUrl),
  githubUrl: opt(githubUrl),
  portfolioUrl: opt(portfolioUrl),
});
