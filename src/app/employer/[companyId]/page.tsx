import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { Alert, Badge } from "@/components/ui/feedback";
import { requireCompanyRole, companyRoleAtLeast } from "@/lib/auth/company";
import { getContexts } from "@/lib/auth/contexts";
import { COMPANY_ROLE_LABELS, listWorkspaces } from "@/lib/auth/destination";

export const metadata: Metadata = { title: "Employer workspace" };

export default async function EmployerWorkspacePage({ params }: PageProps<"/employer/[companyId]">) {
  const { companyId } = await params;
  const { user, company } = await requireCompanyRole(companyId, "reviewer");
  const contexts = await getContexts();
  const workspaces = contexts ? listWorkspaces(contexts) : [];

  return (
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
                {companyRoleAtLeast(company.role, "company_admin") ? "Manage company profile" : "View company profile"}
                <span aria-hidden>→</span>
              </Link>
            </Panel>
            <Panel title={companyRoleAtLeast(company.role, "company_admin") ? "Team management" : "Workspace access"}>
              <div className="flex items-center gap-2">
                <Badge tone="indigo">{company.status === "onboarding" ? "Onboarding" : "Active"}</Badge>
                <span className="text-sm text-ink-muted">Workspace status</span>
              </div>
              {companyRoleAtLeast(company.role, "company_admin") ? (
                <>
                  <p className="mt-4 text-sm text-ink-muted">
                    Invite colleagues, assign workspace access and keep your company team up to date.
                  </p>
                  <Link
                    href={"/employer/" + company.id + "/team"}
                    className="mt-5 inline-flex items-center gap-2 rounded-full border border-line px-5 py-3 text-sm font-semibold text-indigo hover:bg-indigo-soft"
                  >
                    Manage team <span aria-hidden>→</span>
                  </Link>
                </>
              ) : (
                <p className="mt-4 text-sm text-ink-muted">
                  You have Reviewer access. You can view this company workspace, but cannot edit company details or manage team access.
                </p>
              )}
            </Panel>
          </div>
        )}
      </div>
    </AppShell>
  );
}
