import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { CreateCompanyForm, CompanyStatusBadge } from "@/components/admin/employers";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Employers" };

type Company = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
};

const addedDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Maputo",
  }).format(new Date(value));

export default async function EmployersPage() {
  await requireAdmin("admin");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id,name,slug,status,created_at")
    .order("created_at", { ascending: false });

  if (error) console.error("admin employers list failed", error.code, error.message);
  const companies = (data ?? []) as Company[];

  const latestNoteByCompany = new Map<string, string>();
  if (companies.length > 0) {
    const { data: notes, error: notesError } = await supabase
      .from("company_admin_notes")
      .select("company_id,body,created_at")
      .in("company_id", companies.map((company) => company.id))
      .order("created_at", { ascending: false });
    if (notesError) {
      console.error("admin employer notes list failed", notesError.code, notesError.message);
    } else {
      for (const entry of notes ?? []) {
        if (!latestNoteByCompany.has(entry.company_id)) latestNoteByCompany.set(entry.company_id, entry.body);
      }
    }
  }

  return (
    <>
      <PageHeader
        title="Employers"
        lead="Manage the organisations Handson is onboarding for early-career talent programmes."
      />
      <div className="flex flex-col gap-6">
        <Panel title="Register an employer">
          <CreateCompanyForm />
        </Panel>

        <Panel title={"Employer directory (" + companies.length + ")"}>
          {error ? (
            <Alert tone="danger">
              Employer records could not be loaded. Refresh the page or contact a Handson administrator.
            </Alert>
          ) : companies.length === 0 ? (
            <EmptyState title="No employers registered yet">
              Add an employer above after its commercial onboarding has been confirmed.
            </EmptyState>
          ) : (
            <div className="-mx-2 overflow-x-auto sm:mx-0">
              <table className="w-full min-w-[660px] text-left text-[15px]">
                <thead>
                  <tr className="border-b border-line text-sm text-ink-muted">
                    <th className="px-2 py-3 font-medium">Company</th>
                    <th className="px-2 py-3 font-medium">Reserved page slug</th>
                    <th className="px-2 py-3 font-medium">Status</th>
                    <th className="px-2 py-3 font-medium">Contracts</th>
                    <th className="px-2 py-3 text-right font-medium">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id} className="border-b border-line last:border-0">
                      <td className="px-2 py-3">
                        <p className="font-semibold">{company.name}</p>
                        {latestNoteByCompany.get(company.id) && (
                          <p className="mt-1 line-clamp-2 max-w-sm whitespace-pre-wrap text-xs font-normal text-ink-muted">
                            <span className="font-semibold">Internal note: </span>
                            {latestNoteByCompany.get(company.id)}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-3 font-mono text-sm text-ink-muted">{company.slug}</td>
                      <td className="px-2 py-3"><CompanyStatusBadge status={company.status} /></td>
                      <td className="px-2 py-3">
                        <Link
                          href={"/admin/employers/" + company.id + "/contracts"}
                          className="font-semibold text-indigo hover:underline"
                        >
                          Manage contracts
                        </Link>
                      </td>
                      <td className="px-2 py-3 text-right text-sm text-ink-muted tabular-nums">{addedDate(company.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
