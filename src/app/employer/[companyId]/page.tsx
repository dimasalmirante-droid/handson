import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { Alert, Badge } from "@/components/ui/feedback";
import { requireCompanyRole } from "@/lib/auth/company";
import { getContexts } from "@/lib/auth/contexts";
import { COMPANY_ROLE_LABELS, listWorkspaces } from "@/lib/auth/destination";

export const metadata: Metadata = { title: "Employer workspace" };

/**
 * Placeholder for the employer workspace (Module 2, Step 1). Only members of
 * the company can open it; everyone else gets a 404. Employer features are
 * added in later steps.
 */
export default async function EmployerWorkspacePage({ params }: PageProps<"/employer/[companyId]">) {
  const { companyId } = await params;
  const { user, company } = await requireCompanyRole(companyId, "viewer");
  const contexts = await getContexts();
  const workspaces = contexts ? listWorkspaces(contexts) : [];

  return (
    <AppShell email={user.email} home={`/employer/${company.id}`} workspaces={workspaces} current={`company:${company.id}`}>
      <div className="mx-auto max-w-3xl">
        <PageHeader title={company.name} lead={<Badge tone="indigo">{COMPANY_ROLE_LABELS[company.role]}</Badge>} />
        {company.status === "suspended" ? (
          <Alert tone="warning" title="This workspace is suspended">
            Changes are not possible while the workspace is suspended. Contact hello@handson.cloud if you have questions.
          </Alert>
        ) : (
          <Panel title="Workspace being set up">
            <p className="text-[15px] text-ink-muted">
              Your company workspace is being prepared by the Handson team. Company profile and team management will appear here soon.
            </p>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
