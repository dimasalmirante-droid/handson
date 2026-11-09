export const STEPS = [
  { slug: "personal", number: 1, label: "Personal", title: "Personal information" },
  { slug: "education", number: 2, label: "Education", title: "Education" },
  { slug: "skills", number: 3, label: "Skills", title: "Skills" },
  { slug: "interests", number: 4, label: "Interests", title: "Professional interests" },
  { slug: "experience", number: 5, label: "Experience", title: "Experience" },
  { slug: "documents", number: 6, label: "Documents", title: "Documents and portfolio" },
] as const;

export const REVIEW_STEP = 7;

export type StepSlug = (typeof STEPS)[number]["slug"];

export function stepBySlug(slug: string) {
  return STEPS.find((s) => s.slug === slug);
}

export function stepPath(step: number): string {
  if (step >= REVIEW_STEP) return "/onboarding/review";
  return `/onboarding/${STEPS[Math.max(0, step - 1)].slug}`;
}

export function nextPath(step: number): string {
  return stepPath(step + 1);
}

export function prevPath(step: number): string | null {
  return step <= 1 ? null : stepPath(step - 1);
}
