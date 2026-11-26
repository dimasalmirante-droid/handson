import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { Alert } from "@/components/ui/feedback";
import { CompanyProfileForm, type CompanyProfileValues, type IndustryOption } from "@/components/employer/company-profile-form";
import { companyRoleAtLeast, requireCompanyRole } from "@/lib/auth/company";
import { getContexts } from "@/lib/auth/contexts";
import { listWorkspaces } from "@/lib/auth/destination";
import { createClient } from "@/lib/supabase/server";
import { I18nProvider } from "@/i18n/client";

export const metadata: Metadata = { title: "Company profile" };

export default async function CompanyProfilePage({ params }: PageProps<"/employer/[companyId]/profile">) {
  const { companyId } = await params;
  const { user, company } = await requireCompanyRole(companyId, "reviewer");
  const contexts = await getContexts();
  const workspaces = contexts ? listWorkspaces(contexts) : [];
  const supabase = await createClient();

  const [{ data: profile, error: profileError }, { data: industries, error: industriesError }] = await Promise.all([
    supabase
      .from("companies")
      .select("id,name,slug,status,contact_email,description,website,industry_id,country_code,province,city,business_phone")
      .eq("id", companyId)
      .maybeSingle(),
    supabase
      .from("industries")
      .select("id,name_en")
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <I18nProvider locale="en">
    <AppShell email={user.email} home={`/employer/${company.id}`} workspaces={workspaces} current={`company:${company.id}`}>
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Company profile"
          lead={`Manage the details Handson uses inside ${company.name}'s employer workspace.`}
          action={
            <Link href={`/employer/${company.id}`} className="text-sm font-semibold text-indigo hover:underline">
              ← Back to workspace
            </Link>
          }
        />
        {profileError ? (
          <Alert tone="danger">We could not load this company profile. Refresh the page and try again.</Alert>
        ) : !profile ? (
          <Alert tone="danger">This company profile could not be found.</Alert>
        ) : industriesError ? (
          <Alert tone="danger">We could not load the industry list. Refresh the page before updating the profile.</Alert>
        ) : (
          <div className="flex flex-col gap-6">
            <Panel>
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Organisation details</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  These details are available to members of this employer workspace. They will not appear on a public Employer Page until a separate publication process is introduced.
                </p>
              </div>
              <CompanyProfileForm
                companyId={company.id}
                editable={companyRoleAtLeast(company.role, "company_admin")}
                profile={{
                  name: profile.name,
                  slug: profile.slug,
                  contactEmail: profile.contact_email,
                  description: profile.description,
                  website: profile.website,
                  industryId: profile.industry_id,
                  countryCode: profile.country_code,
                  province: profile.province,
                  city: profile.city,
                  businessPhone: profile.business_phone,
                } as CompanyProfileValues}
                industries={(industries ?? []).map((industry) => ({
                  id: Number(industry.id),
                  name: industry.name_en,
                })) as IndustryOption[]}
              />
            </Panel>
            <p className="text-xs text-ink-muted">
              Company status: {company.status}. Editing the profile does not activate or publish the employer.
            </p>
          </div>
        )}
      </div>
    </AppShell>
    </I18nProvider>
  );
}
