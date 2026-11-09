import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { ExperienceStep } from "@/components/onboarding/experience-step";
import { requireUser } from "@/lib/auth/session";
import { getExperiences } from "@/lib/data/student";

export const metadata: Metadata = { title: "Experience" };

export default async function DashboardExperiencePage() {
  const user = await requireUser("/dashboard/experience");
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
