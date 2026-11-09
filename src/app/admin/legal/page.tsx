import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { DraftControls, LegalDraftForm } from "@/components/admin/legal-forms";
import { Alert, Badge } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/admin";
import { getAllLegalDocuments, getCurrentLegalDocuments } from "@/lib/data/legal";
import { LEGAL_LABELS, formatDate } from "@/lib/legal";

export const metadata: Metadata = { title: "Legal documents" };

const toDateInput = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Maputo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

/**
 * Super admins publish the final Terms and Privacy Notice here. Nothing is
 * asked of users until both have a published version whose effective date
 * has arrived.
 */
export default async function LegalAdminPage() {
  await requireAdmin("super_admin");
  const [docs, current] = await Promise.all([getAllLegalDocuments(), getCurrentLegalDocuments()]);
  const inForce = !!(current.terms && current.privacy);

  return (
    <>
      <PageHeader
        title="Legal documents"
        lead="Versions of the Terms and Conditions and the Privacy Notice. Published versions are public and cannot be changed."
      />
      <div className="flex flex-col gap-6">
        <Alert tone={inForce ? "success" : "info"} title={inForce ? "Acceptance is in force" : "Acceptance is not yet in force"}>
          {inForce
            ? "Every user must accept the current Terms and acknowledge the current Privacy Notice once. When you publish a new version of one document, users are asked about that document only."
            : "Users are not asked to accept anything until both a Terms and a Privacy Notice version are published and their effective dates have arrived. Publish only final, approved texts."}
        </Alert>

        <Panel title="Versions">
          {docs.length === 0 ? (
            <p className="text-[15px] text-ink-muted">No versions yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {docs.map((d) => {
                const isCurrent = current[d.kind]?.id === d.id;
                const label = `${LEGAL_LABELS[d.kind]} version ${d.version}`;
                return (
                  <li key={d.id} className="flex flex-col gap-3 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[17px] font-semibold">{label}</span>
                      {d.status === "draft" ? (
                        <Badge>Draft</Badge>
                      ) : isCurrent ? (
                        <Badge tone="success">Current</Badge>
                      ) : new Date(d.effective_at) > new Date() ? (
                        <Badge tone="indigo">Scheduled</Badge>
                      ) : (
                        <Badge>Earlier version</Badge>
                      )}
                      <span className="text-sm text-ink-muted">Effective {formatDate(d.effective_at)}</span>
                      {d.status === "published" && (
                        <Link href={`/legal/${d.kind}/${encodeURIComponent(d.version)}`} className="text-sm font-semibold text-indigo hover:underline">
                          View
                        </Link>
                      )}
                    </div>
                    {d.status === "draft" && (
                      <DraftControls
                        label={label}
                        draft={{
                          id: d.id,
                          kind: d.kind,
                          version: d.version,
                          title: d.title,
                          summary: d.summary ?? "",
                          body: d.body,
                          effective: toDateInput(d.effective_at),
                        }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="New draft">
          <LegalDraftForm />
        </Panel>
      </div>
    </>
  );
}
