import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CompletionSection = { weight: number; score: number; missing: string[] };
export type Completion = {
  total: number;
  sections: Record<"personal" | "education" | "skills" | "interests" | "experience" | "documents", CompletionSection>;
};

export type StudentProfile = {
  id: string;
  email: string;
  first_name: string | null;
  middle_name: string | null;
  surname: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality_code: string | null;
  country_code: string;
  province_id: number | null;
  city: string | null;
  phone: string | null;
  photo_path: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  employer_visibility: boolean;
  verification_status: string;
  onboarding_step: number;
  onboarding_completed_at: string | null;
};

export type EducationRecord = {
  id: string;
  institution_id: string | null;
  institution_name_other: string | null;
  institution_type: string;
  qualification_type_id: number;
  qualification_name: string | null;
  field_of_study_id: number | null;
  field_of_study_other: string | null;
  academic_status: string;
  year_of_study: number | null;
  start_year: number;
  end_year: number | null;
  grade: number | null;
  grade_scale: number;
  language_of_instruction: string | null;
  verification_status: string;
};

export type StudentSkill = {
  id: string;
  skill_id: number | null;
  custom_skill_name: string | null;
  proficiency: string;
};

export type Interests = {
  preferred_roles: string[];
  career_interests: string | null;
  work_arrangements: string[];
  availability: string | null;
  available_from: string | null;
  internship_duration: string | null;
  has_work_experience: boolean | null;
  willing_to_relocate: boolean | null;
  industryIds: number[];
  jobFunctionIds: number[];
  provinceIds: number[];
};

export type ExperienceRecord = {
  id: string;
  organisation: string;
  role_title: string;
  experience_type: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  achievements: string | null;
};

export type DocumentRecord = {
  id: string;
  document_type: string;
  title: string;
  original_filename: string;
  size_bytes: number;
  verification_status: string;
  created_at: string;
};

const PROFILE_COLUMNS =
  "id, email, first_name, middle_name, surname, date_of_birth, gender, nationality_code, country_code, province_id, city, phone, photo_path, linkedin_url, github_url, portfolio_url, employer_visibility, verification_status, onboarding_step, onboarding_completed_at";

/* All loaders below run as the signed-in user: Row Level Security limits them to their own rows. */

export const getProfile = cache(async (userId: string): Promise<StudentProfile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
  return data as StudentProfile | null;
});

export const getEducation = cache(async (userId: string): Promise<EducationRecord[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("education_records")
    .select("id, institution_id, institution_name_other, institution_type, qualification_type_id, qualification_name, field_of_study_id, field_of_study_other, academic_status, year_of_study, start_year, end_year, grade, grade_scale, language_of_instruction, verification_status")
    .eq("profile_id", userId)
    .order("start_year", { ascending: false });
  return (data ?? []) as EducationRecord[];
});

export const getSkills = cache(async (userId: string): Promise<StudentSkill[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_skills")
    .select("id, skill_id, custom_skill_name, proficiency")
    .eq("profile_id", userId)
    .order("created_at");
  return (data ?? []) as StudentSkill[];
});

export const getInterests = cache(async (userId: string): Promise<Interests | null> => {
  const supabase = await createClient();
  const [main, ind, fn, loc] = await Promise.all([
    supabase.from("professional_interests").select("preferred_roles, career_interests, work_arrangements, availability, available_from, internship_duration, has_work_experience, willing_to_relocate").eq("profile_id", userId).maybeSingle(),
    supabase.from("interest_industries").select("industry_id").eq("profile_id", userId),
    supabase.from("interest_job_functions").select("job_function_id").eq("profile_id", userId),
    supabase.from("interest_locations").select("province_id").eq("profile_id", userId),
  ]);
  if (!main.data) return null;
  return {
    ...(main.data as Omit<Interests, "industryIds" | "jobFunctionIds" | "provinceIds">),
    industryIds: (ind.data ?? []).map((r) => r.industry_id as number),
    jobFunctionIds: (fn.data ?? []).map((r) => r.job_function_id as number),
    provinceIds: (loc.data ?? []).map((r) => r.province_id as number),
  };
});

export const getExperiences = cache(async (userId: string): Promise<ExperienceRecord[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("experiences")
    .select("id, organisation, role_title, experience_type, location, start_date, end_date, is_current, description, achievements")
    .eq("profile_id", userId)
    .order("is_current", { ascending: false })
    .order("start_date", { ascending: false });
  return (data ?? []) as ExperienceRecord[];
});

export const getDocuments = cache(async (userId: string): Promise<DocumentRecord[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, document_type, title, original_filename, size_bytes, verification_status, created_at")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as DocumentRecord[];
});

/** Short-lived URL for the student's profile photo (private bucket). */
export const getPhotoUrl = cache(async (path: string | null): Promise<string | null> => {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
});

export const getCompletion = cache(async (userId: string): Promise<Completion | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("profile_completion", { p_profile_id: userId });
  if (error) {
    console.error("profile_completion failed", error.message);
    return null;
  }
  return data as Completion | null;
});

export type Notification = { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

export const getNotifications = cache(async (userId: string, limit = 5): Promise<Notification[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Notification[];
});

export type ConsentRecord = {
  id: string;
  consent_type: string;
  granted: boolean;
  version: string;
  source: string;
  created_at: string;
  /** For final legal documents: "accepted" (Terms) or "acknowledged" (Privacy Notice). */
  action: "accepted" | "acknowledged" | null;
};

export const getConsentHistory = cache(async (userId: string): Promise<ConsentRecord[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("consent_records")
    .select("id, consent_type, granted, version, source, created_at, action")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as ConsentRecord[];
});

/** Where each completion section is edited on the dashboard. */
export const SECTION_DASHBOARD_HREF: Record<string, string> = {
  personal: "/dashboard/profile",
  interests: "/dashboard/profile#interests",
  education: "/dashboard/education",
  skills: "/dashboard/skills",
  experience: "/dashboard/experience",
  documents: "/dashboard/documents",
};

/** Human-readable labels for the `missing` codes returned by profile_completion(). */
export const MISSING_LABELS: Record<string, string> = {
  first_name: "First name",
  surname: "Surname",
  date_of_birth: "Date of birth",
  nationality: "Nationality",
  province: "Province",
  city: "City or district",
  phone: "Phone number",
  education_record: "Add at least one qualification",
  skills_min_3: "Add at least three skills",
  industries: "Industries you are interested in",
  job_functions: "Job functions you are interested in",
  work_arrangements: "Preferred work arrangement",
  availability: "When you can start",
  preferred_locations: "Preferred locations",
  experience_record: "Add an internship, job, volunteering, project or activity",
  cv: "Upload your CV",
  transcript: "Upload your academic transcript",
};
