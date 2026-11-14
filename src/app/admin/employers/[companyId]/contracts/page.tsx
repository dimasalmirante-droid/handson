import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractTerminationControl, CreateCompanyContractForm } from "@/components/admin/company-contracts";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/admin";
import { getCompanyContractStatus, type CompanyContractStatus } from "@/lib/companies/contracts";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Contract register" };

type Company = { id: string; name: string; slug: string; status: string };

type CompanyContract = {
  id: string;
  company_id: string;
  reference: string | null;
  signed_on: string;
  starts_on: string;
  ends_on: string | null;
  service_scope: string;
  internal_note: string | null;
  created_at: string;
  terminated_at: string | null;
  termination_reason: string | null;
};

const STATUS: Record<CompanyContractStatus, { label: string; tone: "indigo" | "success" | "warning" | "danger" }> = {
  scheduled: { label: "Scheduled", tone: "indigo" },
  active: { label: "Active", tone: "success" },
  expired: { label: "Expired", tone: "warning" },
  terminated: { label: "Terminated early", tone: "danger" },
};

function maputoToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Africa/Maputo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Maputo",
  }).format(new Date(value));
}

export default async function EmployerContractsPage({
  params,
}: PageProps<"/admin/employers/[companyId]/contracts">) {
  await requireAdmin("admin");
  const { companyId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(companyId)) notFound();

  const supabase = await createClient();
  const { data: companyData, error: companyError } = await supabase
    .from("companies")
    .select("id,name,slug,status")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError || !companyData) notFound();
  const company = companyData as Company;

  const { data: contractData, error: contractsError } = await supabase
    .from("company_contracts")
    .select("id,company_id,reference,signed_on,starts_on,ends_on,service_scope,internal_note,created_at,terminated_at,termination_reason")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (contractsError) {
    console.error("admin employer contracts list failed", contractsError.code, contractsError.message);
  }

  const contracts = (contractData ?? []) as CompanyContract[];
  const today = maputoToday();

  return (
    <>
      <PageHeader
        title="Contract register"
        lead={<>Signed commercial agreements for <strong>{company.name}</strong>.</>}
        action={
          <Link href="/admin/employers" className="text-sm font-semibold text-indigo hover:underline">
            ← All employers
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <Alert tone="info" title="The physical agreement remains the source of truth">
          Handson stores the contract reference, dates, service scope and internal notes here. Signing, negotiation and the original signed document remain outside the application.
        </Alert>

        <Panel title="Register a signed contract">
          <CreateCompanyContractForm companyId={companyId} />
        </Panel>

        <Panel title={"Signed contracts (" + contracts.length + ")"}>
          {contractsError ? (
            <Alert tone="danger">
              Contract records could not be loaded. Refresh the page or contact a Handson administrator.
            </Alert>
          ) : contracts.length === 0 ? (
            <EmptyState title="No signed contracts registered">
              Add an entry after the physical agreement has been signed. This register does not activate the employer workspace.
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-4">
              {contracts.map((contract) => {
                const status = getCompanyContractStatus(
                  {
                    startsOn: contract.starts_on,
                    endsOn: contract.ends_on,
                    terminatedAt: contract.terminated_at,
                  },
                  today,
                );
                const badge = STATUS[status];

                return (
                  <li key={contract.id} className="rounded-[14px] border border-line p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{contract.reference || "Contract without reference"}</p>
                        <p className="mt-1 text-sm text-ink-muted">
                          Registered {formatDate(contract.created_at.slice(0, 10))}
                        </p>
                      </div>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </div>

                    <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div>
                        <dt className="text-sm text-ink-muted">Date signed</dt>
                        <dd className="font-medium">{formatDate(contract.signed_on)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-ink-muted">Starts</dt>
                        <dd className="font-medium">{formatDate(contract.starts_on)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-ink-muted">Ends</dt>
                        <dd className="font-medium">{contract.ends_on ? formatDate(contract.ends_on) : "No fixed end date"}</dd>
                      </div>
                    </dl>

                    <div className="mt-4">
                      <p className="text-sm font-semibold">Services covered</p>
                      <p className="mt-1 whitespace-pre-wrap text-[15px]">{contract.service_scope}</p>
                    </div>

                    {contract.internal_note && (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-ink-muted">
                        <strong className="font-semibold text-ink">Internal note: </strong>
                        {contract.internal_note}
                      </p>
                    )}

                    {contract.terminated_at && (
                      <div className="mt-4 rounded-[12px] bg-danger-soft px-4 py-3 text-sm">
                        <p className="font-semibold">Terminated on {formatDateTime(contract.terminated_at)}</p>
                        {contract.termination_reason && <p className="mt-1">{contract.termination_reason}</p>}
                      </div>
                    )}

                    {(status === "active" || status === "scheduled") && (
                      <div className="mt-4 border-t border-line pt-4">
                        <ContractTerminationControl companyId={companyId} contractId={contract.id} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
