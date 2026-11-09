import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { GrantRoleForm, RevokeButton } from "@/components/admin/controls";
import { Badge } from "@/components/ui/feedback";
import { ROLE_LABELS, requireAdmin, type AdminRole } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Team" };

type Member = { user_id: string; email: string; role: AdminRole; granted_at: string; granted_by_email: string | null };

export default async function TeamPage() {
  const { user } = await requireAdmin("super_admin");
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_team");
  const team = (data ?? []) as Member[];

  return (
    <>
      <PageHeader title="Team" lead="People with access to the admin portal. Every change is recorded in the audit log." />
      <div className="flex flex-col gap-6">
        <Panel title="Grant access">
          <GrantRoleForm />
          <dl className="mt-6 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[180px_1fr]">
            <dt className="font-semibold">Reviewer</dt>
            <dd className="text-ink-muted">Search students, review profiles and documents, verify or reject.</dd>
            <dt className="font-semibold">Administrator</dt>
            <dd className="text-ink-muted">Everything a reviewer can do, plus suspend accounts and export data.</dd>
            <dt className="font-semibold">Super administrator</dt>
            <dd className="text-ink-muted">Everything, plus manage the team and read the audit log.</dd>
          </dl>
        </Panel>
        <Panel title={`Current team (${team.length})`}>
          <ul className="divide-y divide-line">
            {team.map((m) => (
              <li key={m.user_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    {m.email} {m.user_id === user.id && <span className="text-sm text-ink-muted">(you)</span>}
                  </p>
                  <p className="text-sm text-ink-muted">
                    Since {new Date(m.granted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    {m.granted_by_email ? ` · granted by ${m.granted_by_email}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={m.role === "super_admin" ? "lime" : m.role === "admin" ? "indigo" : "neutral"}>{ROLE_LABELS[m.role]}</Badge>
                  {m.user_id !== user.id && <RevokeButton email={m.email} />}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
