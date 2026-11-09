import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { DocumentsStep } from "@/components/onboarding/documents-step";
import { requireUser } from "@/lib/auth/session";
import { getDocuments, getProfile } from "@/lib/data/student";

export const metadata: Metadata = { title: "Documents" };

export default async function DashboardDocumentsPage() {
  const user = await requireUser("/dashboard/documents");
  const [profile, documents] = await Promise.all([getProfile(user.id), getDocuments(user.id)]);
  return (
    <>
      <PageHeader title="Documents" lead="Your CV, transcript, certificates and portfolio links. Stored privately." />
      <Panel>
        <DocumentsStep
          embedded
          initial={{ linkedinUrl: profile?.linkedin_url ?? "", githubUrl: profile?.github_url ?? "", portfolioUrl: profile?.portfolio_url ?? "" }}
          documents={documents}
        />
      </Panel>
    </>
  );
}
