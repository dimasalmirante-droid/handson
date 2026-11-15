import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { Alert } from "@/components/ui/feedback";
import { CompanyTeamManagement } from "@/components/employer/company-team-management";
import { requireCompanyRole } from "@/lib/auth/company";
import { getContexts } from "@/lib/auth/contexts";
import { listWorkspaces, type CompanyRole } from "@/lib/auth/destination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Company team" };

type TeamMember = {
  user_id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  role: CompanyRole;
  joined_at: string;
};

type PendingInvitation = {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  role: CompanyRole;
  expires_at: string;
  last_sent_at: string | null;
  send_count: number;
};

export default async function CompanyTeamPage({ params }: PageProps<"/employer/[companyId]/team">) {
  const { companyId } = await params;
  const { user, company } = await requireCompanyRole(companyId, "company_admin");
  const contexts = await getContexts();
  const workspaces = contexts ? listWorkspaces(contexts) : [];

  return (
    <AppShell email={user.email} home={"/employer/" + company.id} workspaces={workspaces} current={"company:" + company.id}>
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Team management"
          lead={"Manage who can access " + company.name + "'s Handson workspace."}
          action={
            <Link href={"/employer/" + company.id} className="text-sm font-semibold text-indigo hover:underline">
              ← Back to workspace
            </Link>
          }
        />

        {company.status === "suspended" ? (
          <Alert tone="warning" title="This workspace is suspended">
            Team access cannot be changed while the company workspace is suspended.
          </Alert>
        ) : (
          <TeamManagementData companyId={company.id} companyName={company.name} />
        )}
      </div>
    </AppShell>
  );
}

async function TeamManagementData({ companyId, companyName }: { companyId: string; companyName: string }) {
  const supabase = await createClient();
  const [{ data: teamData, error: teamError }, { data: invitationData, error: invitationError }] = await Promise.all([
    supabase.rpc("company_admin_list_team", { p_company: companyId }),
    supabase
      .from("company_invitations")
      .select("id,email,full_name,job_title,role,expires_at,last_sent_at,send_count")
      .eq("company_id", companyId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  if (teamError || invitationError) {
    if (teamError) console.error("company team list failed", teamError.code);
    if (invitationError) console.error("company team invitation list failed", invitationError.code);
    return (
      <Alert tone="danger">
        We could not load the company team. Refresh the page or contact Handson support before making changes.
      </Alert>
    );
  }

  const members = (teamData ?? []) as TeamMember[];
  const invitations = ((invitationData ?? []) as PendingInvitation[]).map((invitation) => ({
    ...invitation,
    role: invitation.role === "company_admin" ? "company_admin" as const : "reviewer" as const,
  }));

  return (
    <Panel>
      <CompanyTeamManagement
        companyId={companyId}
        companyName={companyName}
        members={members}
        invitations={invitations}
        emailConfigured={Boolean(process.env.RESEND_API_KEY)}
      />
    </Panel>
  );
}
