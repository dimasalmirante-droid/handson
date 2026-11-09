import type { Metadata } from "next";
import { SkillsStep } from "@/components/onboarding/skills-step";
import { StepHeader } from "@/components/onboarding/wizard";
import { requireUser } from "@/lib/auth/session";
import { getCatalogues } from "@/lib/data/catalogues";
import { getSkills } from "@/lib/data/student";

export const metadata: Metadata = { title: "Skills" };

export default async function SkillsPage() {
  const user = await requireUser("/onboarding/skills");
  const [mine, catalogues] = await Promise.all([getSkills(user.id), getCatalogues()]);

  return (
    <>
      <StepHeader
        step={3}
        title="Skills"
        lead="Add the skills you can offer an employer: software, languages, technical and professional skills. Each skill saves as you add it."
      />
      <SkillsStep mine={mine} skills={catalogues.skills} categories={catalogues.skillCategories} />
    </>
  );
}
