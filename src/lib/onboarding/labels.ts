/** Display labels shared by server and client components. */

export const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  university: "University",
  polytechnic: "Polytechnic institute",
  tvet: "TVET / vocational institute",
  secondary: "Secondary school",
  other: "Other",
};

export const ACADEMIC_STATUS_LABELS: Record<string, string> = {
  enrolled: "Currently studying",
  graduated: "Completed",
  deferred: "Paused or deferred",
  discontinued: "Did not complete",
};

export const EXPERIENCE_LABELS: Record<string, string> = {
  internship: "Internship",
  part_time: "Part-time job",
  full_time: "Full-time job",
  volunteering: "Volunteering",
  university_project: "University or course project",
  extracurricular: "Extracurricular activity",
  freelance: "Freelance or self-employed",
  other: "Other",
};

export const PROFICIENCY_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

export const ARRANGEMENT_LABELS: Record<string, string> = { on_site: "On site", hybrid: "Hybrid", remote: "Remote" };

export const AVAILABILITY_LABELS: Record<string, string> = {
  immediately: "Immediately",
  within_1_month: "Within 1 month",
  within_3_months: "Within 3 months",
  after_graduation: "After graduation",
  specific_date: "From a specific date",
};

export const SECTION_LABELS: Record<string, { title: string; href: string }> = {
  personal: { title: "Personal information", href: "/onboarding/personal" },
  education: { title: "Education", href: "/onboarding/education" },
  skills: { title: "Skills", href: "/onboarding/skills" },
  interests: { title: "Professional interests", href: "/onboarding/interests" },
  experience: { title: "Experience", href: "/onboarding/experience" },
  documents: { title: "Documents and portfolio", href: "/onboarding/documents" },
};
