import type { Metadata } from "next";
import { ExperienceStep } from "@/components/onboarding/experience-step";
import { StepHeader } from "@/components/onboarding/wizard";
import { requireStudent } from "@/lib/auth/session";
import { getExperiences } from "@/lib/data/student";

export const metadata: Metadata = { title: "Experience" };

export default async function ExperiencePage() {
  const user = await requireStudent("/onboarding/experience");
  const records = await getExperiences(user.id);

  return (
    <>
      <StepHeader
        step={5}
        title="Experience"
        lead="Internships, jobs, volunteering, university projects and extracurricular activities all show employers what you can do."
      />
      <ExperienceStep userId={user.id} records={records} />
    </>
  );
}
