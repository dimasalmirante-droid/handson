import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CompanyAdminInvitationPanel } from "@/components/admin/company-admin-invitation";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Company administrator" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Company = { id: string; name: string; slug: string; status: string };
type CompanyAdminMember = { full_name: string | null; job_title: string | null; created_at: string };
type Invitation = {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  last_sent_at: string | null;
  send_count: number;
};

const statusLabel: Record<string, string> = {
  onboarding: "Onboarding",
  active: "Active",
  suspended: "Suspended",
};

export default async function CompanyAdministratorPage({
  params,
}: PageProps<"/admin/employers/[companyId]/administrator">) {
  await requireAdmin("admin");
  const { companyId } = await params;
  if (!UUID.test(companyId)) notFound();

  const supabase = await createClient();
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id,name,slug,status")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError || !company) notFound();

  const [{ data: administrators, error: administratorError }, { data: invitations, error: invitationError }] =
    await Promise.all([
      supabase
        .from("company_members")
        .select("full_name,job_title,created_at")
        .eq("company_id", companyId)
        .eq("role", "company_admin")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("company_invitations")
        .select("id,email,full_name,job_title,status,expires_at,created_at,last_sent_at,send_count")
        .eq("company_id", companyId)
        .eq("role", "company_admin")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

  if (administratorError) console.error("company administrator lookup failed", administratorError.code);
  if (invitationError) console.error("company administrator invitation lookup failed", invitationError.code);

  const currentAdmin = (administrators?.[0] ?? null) as CompanyAdminMember | null;
  const invitation = (invitations?.[0] ?? null) as Invitation | null;

  return (
    <>
      <PageHeader
        title="Company administrator"
        lead="Appoint the first person authorised to manage this employer's Handson workspace."
        action={<ButtonLink href="/admin/employers" variant="ghost">← Back to employers</ButtonLink>}
      />
      <div className="flex flex-col gap-6">
        <Panel title="Employer">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold">{company.name}</h2>
            <Badge tone={company.status === "suspended" ? "danger" : company.status === "active" ? "success" : "indigo"}>
              {statusLabel[company.status] ?? company.status}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Public page reserved at <span className="font-mono">/{company.slug}</span>. The page is not published.
          </p>
        </Panel>

        <Panel title="First Company Administrator">
          <p className="mb-5 max-w-2xl text-sm text-ink-muted">
            The invited person uses their own Handson account. Handson will not create a duplicate account or grant access until the person accepts the invitation using the verified email address it was sent to.
          </p>
          {administratorError || invitationError ? (
            <Alert tone="danger">
              We could not verify this employer's administrator or invitation status. Refresh the page before making changes, so we do not create a duplicate invitation.
            </Alert>
          ) : (
            <CompanyAdminInvitationPanel
              companyId={company.id}
              companyStatus={company.status}
              emailConfigured={Boolean(process.env.RESEND_API_KEY)}
              currentAdmin={currentAdmin}
              invitation={invitation}
            />
          )}
        </Panel>

        <p className="text-sm text-ink-muted">
          Need to update company details? Return to the <Link href="/admin/employers" className="font-semibold text-indigo hover:underline">employer directory</Link>.
        </p>
      </div>
    </>
  );
}
