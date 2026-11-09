import type { Metadata } from "next";
import { EducationStep } from "@/components/onboarding/education-step";
import { StepHeader } from "@/components/onboarding/wizard";
import { requireStudent } from "@/lib/auth/session";
import { getCatalogues } from "@/lib/data/catalogues";
import { getEducation } from "@/lib/data/student";

export const metadata: Metadata = { title: "Education" };

export default async function EducationPage() {
  const user = await requireStudent("/onboarding/education");
  const [records, catalogues] = await Promise.all([getEducation(user.id), getCatalogues()]);

  return (
    <>
      <StepHeader
        step={2}
        title="Education"
        lead="Add your current course and any qualifications you have completed. You can add more than one."
      />
      <EducationStep
        userId={user.id}
        records={records}
        catalogues={{
          institutions: catalogues.institutions,
          qualificationTypes: catalogues.qualificationTypes,
          fieldsOfStudy: catalogues.fieldsOfStudy,
        }}
      />
    </>
  );
}
