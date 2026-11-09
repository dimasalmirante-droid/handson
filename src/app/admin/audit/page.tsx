import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireAdmin } from "@/lib/auth/admin";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log" };

type Entry = { id: number; created_at: string; actor_email: string | null; action: string; target_table: string | null; target_id: string | null; metadata: Record<string, unknown>; total_count: number };
const PAGE = 50;

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin("super_admin");
  const sp = await searchParams;
  const target = typeof sp.target === "string" && /^[0-9a-f-]{36}$/.test(sp.target) ? sp.target : null;
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_audit_log", { p_target: target, p_limit: PAGE, p_offset: (page - 1) * PAGE });
  const rows = (data ?? []) as Entry[];
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: number) => `/admin/audit?${new URLSearchParams({ ...(target ? { target } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <>
      <PageHeader
        title="Audit log"
        lead={target ? "Actions relating to one student." : "Sensitive administrator actions, newest first. Entries cannot be edited or deleted."}
        action={target ? <Link href="/admin/audit" className={buttonClasses({ variant: "secondary" })}>Show all</Link> : undefined}
      />
      {rows.length === 0 ? (
        <EmptyState title="No entries yet" />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-line bg-surface-raised">
          <table className="w-full min-w-[760px] text-[15px]">
            <thead>
              <tr className="border-b border-line text-left text-sm text-ink-muted">
                <th scope="col" className="px-4 py-3 font-medium">When</th>
                <th scope="col" className="px-4 py-3 font-medium">Who</th>
                <th scope="col" className="px-4 py-3 font-medium">Action</th>
                <th scope="col" className="px-4 py-3 font-medium">Target</th>
                <th scope="col" className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const profileId = r.target_table === "profiles" ? r.target_id : (r.metadata?.profile_id as string | undefined);
                const details = Object.entries(r.metadata ?? {}).filter(([k, v]) => k !== "profile_id" && v !== null && v !== "");
                return (
                  <tr key={r.id} className="border-b border-line align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-ink-muted">
                      {new Date(r.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Maputo" })}
                    </td>
                    <td className="px-4 py-3 text-sm">{r.actor_email ?? "system"}</td>
                    <td className="px-4 py-3 font-medium">{r.action}</td>
                    <td className="px-4 py-3 text-sm">
                      {profileId ? <Link href={`/admin/students/${profileId}`} className="text-indigo hover:underline">Student</Link> : r.target_table ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink-muted">
                      {details.length ? details.map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
          <p className="text-sm text-ink-muted">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <Link href={link(page - 1)} className={cn(buttonClasses({ variant: "secondary", size: "sm" }), page <= 1 && "pointer-events-none opacity-40")}>← Newer</Link>
            <Link href={link(page + 1)} className={cn(buttonClasses({ variant: "secondary", size: "sm" }), page >= pages && "pointer-events-none opacity-40")}>Older →</Link>
          </div>
        </nav>
      )}
    </>
  );
}
