import type { Completion, DocumentRecord, EducationRecord, StudentProfile } from "@/lib/data/student";

/**
 * One task per gap in the profile, in the order a student should tackle them.
 * The first one becomes the "Next step"; a few more are listed below it.
 */
export type Task = { key: string; title: string; why: string; action: string; href: string };

const TASKS: Task[] = [
  { key: "personal", title: "Complete your personal information", why: "Employers need to know who you are and how to reach you.", action: "Complete details", href: "/dashboard/profile?edit=about" },
  { key: "headline", title: "Write your professional headline", why: "It is the first thing employers read: one line on what you study and what you are looking for.", action: "Write headline", href: "/dashboard/profile?edit=about" },
  { key: "education", title: "Add your qualification", why: "Employers look at education first. It takes about two minutes.", action: "Add qualification", href: "/dashboard/profile?edit=education" },
  { key: "skills", title: "Add at least three skills", why: "Include software, languages and professional skills you can offer.", action: "Add skills", href: "/dashboard/profile?edit=skills" },
  { key: "experience", title: "Add an experience", why: "Internships, volunteering, projects and student activities all count.", action: "Add experience", href: "/dashboard/profile?edit=experience" },
  { key: "interests", title: "Tell us what you are looking for", why: "Choose the industries, roles and places that interest you.", action: "Choose preferences", href: "/dashboard/profile?edit=preferences" },
  { key: "cv", title: "Upload your CV", why: "You can also create one for free from your profile in My CV.", action: "Upload CV", href: "/dashboard/profile?edit=documents" },
  { key: "transcript", title: "Upload your academic transcript", why: "Employers often ask for your grades.", action: "Upload transcript", href: "/dashboard/profile?edit=documents" },
];

/** Which tasks are still open, from the completion result and the profile. */
export function openTasks(profile: Pick<StudentProfile, "headline">, completion: Completion | null): Task[] {
  const missing = (section: keyof Completion["sections"]) => completion?.sections[section]?.missing ?? [];
  const open = new Set<string>();
  if (missing("personal").length) open.add("personal");
  // The headline is required by the app but not part of the completion score.
  if (!profile.headline) open.add("headline");
  if (missing("education").length) open.add("education");
  if (missing("skills").length) open.add("skills");
  if (missing("experience").length) open.add("experience");
  if (missing("interests").length) open.add("interests");
  if (missing("documents").includes("cv")) open.add("cv");
  if (missing("documents").includes("transcript")) open.add("transcript");
  return TASKS.filter((t) => open.has(t.key));
}

/** Where to send the student when Handson asked for changes: the first item that was not verified. */
export function changesHref(education: Pick<EducationRecord, "verification_status">[], documents: Pick<DocumentRecord, "verification_status">[]): string {
  if (education.some((e) => e.verification_status === "rejected")) return "/dashboard/profile?edit=education";
  if (documents.some((d) => d.verification_status === "rejected")) return "/dashboard/profile?edit=documents";
  return "/dashboard/profile";
}
