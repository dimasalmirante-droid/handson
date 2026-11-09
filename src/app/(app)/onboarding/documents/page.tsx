import type { Metadata } from "next";
import { DocumentsStep } from "@/components/onboarding/documents-step";
import { StepHeader } from "@/components/onboarding/wizard";
import { requireStudent } from "@/lib/auth/session";
import { getDocuments, getProfile } from "@/lib/data/student";

export const metadata: Metadata = { title: "Documents and portfolio" };

export default async function DocumentsPage() {
  const user = await requireStudent("/onboarding/documents");
  const [profile, documents] = await Promise.all([getProfile(user.id), getDocuments(user.id)]);

  return (
    <>
      <StepHeader step={6} title="Documents and portfolio" lead="Your CV, transcript and certificates, plus links to your work online." />
      <DocumentsStep
        initial={{
          linkedinUrl: profile?.linkedin_url ?? "",
          githubUrl: profile?.github_url ?? "",
          portfolioUrl: profile?.portfolio_url ?? "",
        }}
        documents={documents}
      />
    </>
  );
}
