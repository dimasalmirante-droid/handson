import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { ExperienceStep } from "@/components/onboarding/experience-step";
import { requireStudent } from "@/lib/auth/session";
import { getExperiences } from "@/lib/data/student";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Experience") };
}

export default async function DashboardExperiencePage() {
  const user = await requireStudent("/dashboard/experience");
  const records = await getExperiences(user.id);
  return (
    <>
      <PageHeader title="Experience" lead="Internships, jobs, volunteering, projects and activities." />
      <Panel>
        <ExperienceStep embedded userId={user.id} records={records} />
      </Panel>
    </>
  );
}
