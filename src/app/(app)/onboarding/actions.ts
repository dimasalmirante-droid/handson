"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth/session";
import { REVIEW_STEP, nextPath } from "@/lib/onboarding/steps";
import { createClient } from "@/lib/supabase/server";
import {
  addSkillSchema,
  educationSchema,
  experienceSchema,
  interestsSchema,
  linksSchema,
  personalDraftSchema,
  personalRequiredSchema,
  PROFICIENCY,
  zodFieldErrors,
  type FieldErrors,
} from "@/lib/validation/profile";

export type SaveResult = {
  ok: boolean;
  error?: string;
  fields?: FieldErrors;
  id?: string;
  next?: string;
};

const GENERIC = "Your changes could not be saved. Please try again.";

/** Turn database errors into messages a student can act on. */
function dbError(error: PostgrestError): SaveResult {
  if (error.code === "P0001" && error.message.startsWith("Limit reached")) {
    return { ok: false, error: "You have reached the maximum number of entries for this section." };
  }
  if (error.code === "23505") return { ok: false, error: "You have already added this." };
  if (error.code === "23514") return { ok: false, error: "Some information is not valid. Please check the form." };
  console.error("database error", error.code, error.message);
  return { ok: false, error: GENERIC };
}

async function context() {
  const user = await requireUser("/onboarding");
  const supabase = await createClient();
  return { user, supabase };
}

function refresh() {
  revalidatePath("/onboarding", "layout");
}

/** Record progress so the student resumes at the furthest step reached. */
async function advanceTo(step: number) {
  const { user, supabase } = await context();
  const { data } = await supabase.from("profiles").select("onboarding_step").eq("id", user.id).single();
  if (!data || data.onboarding_step < step) {
    await supabase.from("profiles").update({ onboarding_step: Math.min(step, REVIEW_STEP) }).eq("id", user.id);
  }
}

/** Continue from a step whose data is saved separately (education, skills, experience, documents). */
export async function continueFrom(step: number): Promise<SaveResult> {
  await advanceTo(step + 1);
  refresh();
  return { ok: true, next: nextPath(step) };
}

/* ------------------------------------------------------------------ */
/* Step 1 · Personal information                                       */
/* ------------------------------------------------------------------ */

export async function savePersonal(values: Record<string, string>, mode: "draft" | "continue"): Promise<SaveResult> {
  const { user, supabase } = await context();
  const parsed = (mode === "continue" ? personalRequiredSchema : personalDraftSchema).safeParse(values);
  if (!parsed.success) return { ok: false, fields: zodFieldErrors(parsed.error) };

  const v = parsed.data;
  const country = v.country ?? "MZ";
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: v.firstName ?? null,
      middle_name: v.middleName ?? null,
      surname: v.surname ?? null,
      date_of_birth: v.dateOfBirth ?? null,
      gender: v.gender ?? null,
      nationality_code: v.nationality ?? null,
      country_code: country,
      province_id: country === "MZ" ? (v.provinceId ?? null) : null,
      city: v.city ?? null,
      phone: v.phone ?? null,
      linkedin_url: v.linkedinUrl ?? null,
    })
    .eq("id", user.id);
  if (error) return dbError(error);

  if (mode === "continue") {
    await advanceTo(2);
    refresh();
    return { ok: true, next: nextPath(1) };
  }
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Step 2 · Education                                                  */
/* ------------------------------------------------------------------ */

export async function saveEducation(values: Record<string, string>): Promise<SaveResult> {
  const { user, supabase } = await context();
  const parsed = educationSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fields: zodFieldErrors(parsed.error) };
  const v = parsed.data;

  const row = {
    institution_id: v.institutionId ?? null,
    institution_name_other: v.institutionId ? null : (v.institutionNameOther ?? null),
    institution_type: v.institutionType,
    qualification_type_id: v.qualificationTypeId,
    qualification_name: v.qualificationName ?? null,
    field_of_study_id: v.fieldOfStudyId ?? null,
    field_of_study_other: v.fieldOfStudyOther ?? null,
    academic_status: v.academicStatus,
    year_of_study: v.academicStatus === "enrolled" ? (v.yearOfStudy ?? null) : null,
    start_year: v.startYear,
    end_year: v.endYear ?? null,
    grade: v.grade ?? null,
    grade_scale: v.gradeScale,
    language_of_instruction: v.languageOfInstruction ?? null,
  };

  const query = v.id
    ? supabase.from("education_records").update(row).eq("id", v.id).eq("profile_id", user.id).select("id").single()
    : supabase.from("education_records").insert({ ...row, profile_id: user.id }).select("id").single();
  const { data, error } = await query;
  if (error) return dbError(error);
  refresh();
  return { ok: true, id: data.id };
}

export async function deleteEducation(id: string): Promise<SaveResult> {
  const { user, supabase } = await context();
  const { error } = await supabase.from("education_records").delete().eq("id", id).eq("profile_id", user.id);
  if (error) return dbError(error);
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Step 3 · Skills                                                     */
/* ------------------------------------------------------------------ */

export async function addSkill(input: { skillId?: number; customName?: string; proficiency: string }): Promise<SaveResult> {
  const { user, supabase } = await context();
  const parsed = addSkillSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: zodFieldErrors(parsed.error) };
  const { data, error } = await supabase
    .from("student_skills")
    .insert({
      profile_id: user.id,
      skill_id: parsed.data.skillId ?? null,
      custom_skill_name: parsed.data.customName ?? null,
      proficiency: parsed.data.proficiency,
    })
    .select("id")
    .single();
  if (error) return dbError(error);
  refresh();
  return { ok: true, id: data.id };
}

export async function updateSkillLevel(id: string, proficiency: string): Promise<SaveResult> {
  const { user, supabase } = await context();
  if (!(PROFICIENCY as readonly string[]).includes(proficiency)) return { ok: false, error: GENERIC };
  const { error } = await supabase.from("student_skills").update({ proficiency }).eq("id", id).eq("profile_id", user.id);
  if (error) return dbError(error);
  refresh();
  return { ok: true };
}

export async function removeSkill(id: string): Promise<SaveResult> {
  const { user, supabase } = await context();
  const { error } = await supabase.from("student_skills").delete().eq("id", id).eq("profile_id", user.id);
  if (error) return dbError(error);
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Step 4 · Professional interests                                     */
/* ------------------------------------------------------------------ */

async function syncLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "interest_industries" | "interest_job_functions" | "interest_locations",
  column: "industry_id" | "job_function_id" | "province_id",
  userId: string,
  ids: number[],
) {
  const unique = [...new Set(ids)];
  const del = supabase.from(table).delete().eq("profile_id", userId);
  const { error: delError } = unique.length ? await del.not(column, "in", `(${unique.join(",")})`) : await del;
  if (delError) return delError;
  if (!unique.length) return null;
  const { error } = await supabase
    .from(table)
    .upsert(unique.map((id) => ({ profile_id: userId, [column]: id })), { onConflict: `profile_id,${column}`, ignoreDuplicates: true });
  return error;
}

export async function saveInterests(values: unknown): Promise<SaveResult> {
  const { user, supabase } = await context();
  const parsed = interestsSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fields: zodFieldErrors(parsed.error) };
  const v = parsed.data;

  const { error } = await supabase.from("professional_interests").upsert(
    {
      profile_id: user.id,
      preferred_roles: v.preferredRoles,
      career_interests: v.careerInterests || null,
      work_arrangements: v.workArrangements,
      availability: v.availability,
      available_from: v.availability === "specific_date" ? v.availableFrom : null,
      internship_duration: v.internshipDuration,
      has_work_experience: v.hasWorkExperience,
      willing_to_relocate: v.willingToRelocate,
    },
    { onConflict: "profile_id" },
  );
  if (error) return dbError(error);

  for (const [table, column, ids] of [
    ["interest_industries", "industry_id", v.industryIds],
    ["interest_job_functions", "job_function_id", v.jobFunctionIds],
    ["interest_locations", "province_id", v.provinceIds],
  ] as const) {
    const linkError = await syncLinks(supabase, table, column, user.id, ids);
    if (linkError) return dbError(linkError);
  }
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Step 5 · Experience                                                 */
/* ------------------------------------------------------------------ */

export async function saveExperience(values: Record<string, string>): Promise<SaveResult> {
  const { user, supabase } = await context();
  const parsed = experienceSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fields: zodFieldErrors(parsed.error) };
  const v = parsed.data;

  const row = {
    organisation: v.organisation,
    role_title: v.roleTitle,
    experience_type: v.experienceType,
    location: v.location ?? null,
    start_date: v.startMonth,
    end_date: v.isCurrent ? null : (v.endMonth ?? null),
    is_current: v.isCurrent,
    description: v.description ?? null,
    achievements: v.achievements ?? null,
  };
  const query = v.id
    ? supabase.from("experiences").update(row).eq("id", v.id).eq("profile_id", user.id).select("id").single()
    : supabase.from("experiences").insert({ ...row, profile_id: user.id }).select("id").single();
  const { data, error } = await query;
  if (error) return dbError(error);
  refresh();
  return { ok: true, id: data.id };
}

export async function deleteExperience(id: string): Promise<SaveResult> {
  const { user, supabase } = await context();
  const { error } = await supabase.from("experiences").delete().eq("id", id).eq("profile_id", user.id);
  if (error) return dbError(error);
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Step 6 · Portfolio links                                            */
/* ------------------------------------------------------------------ */

export async function saveLinks(values: Record<string, string>, mode: "draft" | "continue"): Promise<SaveResult> {
  const { user, supabase } = await context();
  const parsed = linksSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fields: zodFieldErrors(parsed.error) };
  const { error } = await supabase
    .from("profiles")
    .update({
      linkedin_url: parsed.data.linkedinUrl ?? null,
      github_url: parsed.data.githubUrl ?? null,
      portfolio_url: parsed.data.portfolioUrl ?? null,
    })
    .eq("id", user.id);
  if (error) return dbError(error);
  if (mode === "continue") return continueFrom(6);
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Finish                                                              */
/* ------------------------------------------------------------------ */

export async function finishOnboarding(): Promise<void> {
  const { user, supabase } = await context();
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString(), onboarding_step: REVIEW_STEP })
    .eq("id", user.id)
    .is("onboarding_completed_at", null);
  if (error) {
    console.error("finishOnboarding failed", error.code, error.message);
    redirect("/onboarding/review?error=finish");
  }
  revalidatePath("/", "layout");
  redirect("/dashboard?notice=onboarding-complete");
}
