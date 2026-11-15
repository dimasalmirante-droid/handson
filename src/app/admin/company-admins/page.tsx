import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Company administrators" };

type Company = { id: string; name: string; status: string };
type CompanyAdmin = { company_id: string; full_name: string | null; job_title: string | null };

const statusTone = (status: string): "indigo" | "success" | "danger" =>
  status === "suspended" ? "danger" : status === "active" ? "success" : "indigo";

export default async function CompanyAdminsPage() {
  await requireAdmin("admin");
  const supabase = await createClient();
  const [{ data: companies, error: companiesError }, { data: members, error: membersError }] = await Promise.all([
    supabase.from("companies").select("id,name,status").order("name", { ascending: true }),
    supabase
      .from("company_members")
      .select("company_id,full_name,job_title")
      .eq("role", "company_admin"),
  ]);

  if (companiesError) console.error("company administrator directory failed", companiesError.code);
  if (membersError) console.error("company administrator member lookup failed", membersError.code);

  const administratorByCompany = new Map<string, CompanyAdmin>();
  for (const member of (members ?? []) as CompanyAdmin[]) {
    if (!administratorByCompany.has(member.company_id)) administratorByCompany.set(member.company_id, member);
  }

  return (
    <>
      <PageHeader
        title="Company administrators"
        lead="Appoint and manage the first person authorised to manage each employer workspace."
      />
      <Panel title={`Employer workspaces (${companies?.length ?? 0})`}>
        {companiesError ? (
          <Alert tone="danger">Employer records could not be loaded. Refresh the page or contact a Handson administrator.</Alert>
        ) : !companies?.length ? (
          <EmptyState title="No employers registered yet">
            Register an employer before appointing its first Company Administrator.
          </EmptyState>
        ) : (
          <div className="-mx-2 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[620px] text-left text-[15px]">
              <thead>
                <tr className="border-b border-line text-sm text-ink-muted">
                  <th className="px-2 py-3 font-medium">Employer</th>
                  <th className="px-2 py-3 font-medium">Workspace</th>
                  <th className="px-2 py-3 font-medium">First administrator</th>
                  <th className="px-2 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {(companies as Company[]).map((company) => {
                  const admin = administratorByCompany.get(company.id);
                  return (
                    <tr key={company.id} className="border-b border-line last:border-0">
                      <td className="px-2 py-3 font-semibold">{company.name}</td>
                      <td className="px-2 py-3">
                        <Badge tone={statusTone(company.status)}>{company.status}</Badge>
                      </td>
                      <td className="px-2 py-3">
                        {admin ? (
                          <div>
                            <p className="font-medium">{admin.full_name || "Company Administrator"}</p>
                            {admin.job_title && <p className="text-sm text-ink-muted">{admin.job_title}</p>}
                          </div>
                        ) : membersError ? (
                          <span className="text-sm text-ink-muted">Could not verify</span>
                        ) : (
                          <span className="text-sm text-ink-muted">Not yet appointed</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <ButtonLink href={`/admin/employers/${company.id}/administrator`} size="sm" variant="ghost">
                          {admin ? "View" : "Appoint"}
                        </ButtonLink>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {membersError && <Alert tone="warning">Some administrator names may not be available. You can still open each employer to check its invitation status.</Alert>}
      <p className="mt-6 text-sm text-ink-muted">
        Employer workspaces remain in their current status. Appointing an administrator does not activate or publish a company.
        <Link href="/admin/employers" className="ml-1 font-semibold text-indigo hover:underline">Open employer directory</Link>.
      </p>
    </>
  );
}
