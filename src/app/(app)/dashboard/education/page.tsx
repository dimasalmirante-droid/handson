import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { EducationStep } from "@/components/onboarding/education-step";
import { requireStudent } from "@/lib/auth/session";
import { getCatalogues } from "@/lib/data/catalogues";
import { getEducation } from "@/lib/data/student";

export const metadata: Metadata = { title: "Education" };

export default async function DashboardEducationPage() {
  const user = await requireStudent("/dashboard/education");
  const [records, catalogues] = await Promise.all([getEducation(user.id), getCatalogues()]);
  return (
    <>
      <PageHeader title="Education" lead="Your qualifications. Editing a verified qualification sends it back for review." />
      <Panel>
        <EducationStep
          embedded
          userId={user.id}
          records={records}
          catalogues={{ institutions: catalogues.institutions, qualificationTypes: catalogues.qualificationTypes, fieldsOfStudy: catalogues.fieldsOfStudy }}
        />
      </Panel>
    </>
  );
}
