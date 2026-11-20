import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { Alert, Badge } from "@/components/ui/feedback";
import { requireCompanyRole, companyRoleAtLeast } from "@/lib/auth/company";
import { getContexts } from "@/lib/auth/contexts";
import { COMPANY_ROLE_LABELS, listWorkspaces } from "@/lib/auth/destination";
import { I18nProvider } from "@/i18n/client";

export const metadata: Metadata = { title: "Employer workspace" };

export default async function EmployerWorkspacePage({ params }: PageProps<"/employer/[companyId]">) {
  const { companyId } = await params;
  const { user, company } = await requireCompanyRole(companyId, "viewer");
  const contexts = await getContexts();
  const workspaces = contexts ? listWorkspaces(contexts) : [];

  return (
    <I18nProvider locale="en">
    <AppShell email={user.email} home={`/employer/${company.id}`} workspaces={workspaces} current={`company:${company.id}`}>
      <div className="mx-auto max-w-4xl">
        <PageHeader title={company.name} lead={<Badge tone="indigo">{COMPANY_ROLE_LABELS[company.role]}</Badge>} />
        {company.status === "suspended" ? (
          <Alert tone="warning" title="This workspace is suspended">
            Changes are not possible while the workspace is suspended. Contact hello@handson.cloud if you have questions.
          </Alert>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <Panel title="Company profile">
              <p className="mb-5 text-sm text-ink-muted">
                Add your organisation&apos;s website, industry, location and official contact details. These details are visible within your workspace and are not published automatically.
              </p>
              <Link
                href={`/employer/${company.id}/profile`}
                className="inline-flex items-center gap-2 rounded-full bg-indigo px-5 py-3 text-sm font-semibold text-white hover:bg-indigo/90"
              >
                {companyRoleAtLeast(company.role, "editor") ? "Manage company profile" : "View company profile"}
                <span aria-hidden>→</span>
              </Link>
            </Panel>
            <Panel title="Your company workspace">
              <div className="flex items-center gap-2">
                <Badge tone="indigo">{company.status === "onboarding" ? "Onboarding" : "Active"}</Badge>
                <span className="text-sm text-ink-muted">Workspace status</span>
              </div>
              <p className="mt-4 text-sm text-ink-muted">
                Team management and employer tools will be added here in the next step.
              </p>
            </Panel>
          </div>
        )}
      </div>
    </AppShell>
    </I18nProvider>
  );
}
