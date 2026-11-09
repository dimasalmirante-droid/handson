import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { SkillsStep } from "@/components/onboarding/skills-step";
import { requireStudent } from "@/lib/auth/session";
import { getCatalogues } from "@/lib/data/catalogues";
import { getSkills } from "@/lib/data/student";

export const metadata: Metadata = { title: "Skills" };

export default async function DashboardSkillsPage() {
  const user = await requireStudent("/dashboard/skills");
  const [mine, catalogues] = await Promise.all([getSkills(user.id), getCatalogues()]);
  return (
    <>
      <PageHeader title="Skills" lead="Software, languages, technical and professional skills. Each change saves immediately." />
      <Panel>
        <SkillsStep embedded mine={mine} skills={catalogues.skills} categories={catalogues.skillCategories} />
      </Panel>
    </>
  );
}
