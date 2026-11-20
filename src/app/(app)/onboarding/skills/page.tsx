import type { Metadata } from "next";
import { SkillsStep } from "@/components/onboarding/skills-step";
import { StepHeader } from "@/components/onboarding/wizard";
import { requireStudent } from "@/lib/auth/session";
import { getCatalogues } from "@/lib/data/catalogues";
import { getLanguages, getSkills } from "@/lib/data/student";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Skills") };
}

export default async function SkillsPage() {
  const user = await requireStudent("/onboarding/skills");
  const [mine, myLanguages, catalogues] = await Promise.all([getSkills(user.id), getLanguages(user.id), getCatalogues()]);

  return (
    <>
      <StepHeader
        step={3}
        title="Skills"
        lead="Add the skills you can offer an employer: software, languages, technical and professional skills. Each skill saves as you add it."
      />
      <SkillsStep mine={mine} skills={catalogues.skills} categories={catalogues.skillCategories} myLanguages={myLanguages} languages={catalogues.languages} />
    </>
  );
}
