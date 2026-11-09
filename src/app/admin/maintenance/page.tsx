import type { Metadata } from "next";
import { CleanOrphansButton } from "@/components/admin/controls";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { requireAdmin } from "@/lib/auth/admin";
import { formatBytes } from "@/lib/files";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Maintenance" };

export default async function MaintenancePage() {
  await requireAdmin("super_admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_orphaned_files");
  const files = (data ?? []) as { bucket_id: string; name: string; size_bytes: number; created_at: string }[];
  const total = files.reduce((n, f) => n + Number(f.size_bytes || 0), 0);

  return (
    <>
      <PageHeader title="Maintenance" lead="Housekeeping tasks for super administrators." />
      <Panel title="Orphaned files">
        <p className="text-[15px] text-ink-muted">
          Files uploaded more than 24 hours ago that are not attached to any profile, usually from interrupted uploads. Files that
          belong to a student&apos;s documents or profile photo are never removed.
        </p>
        {error ? (
          <p className="mt-4 text-danger">The file list could not be loaded.</p>
        ) : (
          <>
            <p className="mt-4 font-semibold">
              {files.length === 0 ? "No orphaned files." : `${files.length} orphaned file(s), ${formatBytes(total)} in total.`}
            </p>
            {files.length > 0 && (
              <ul className="mt-3 max-h-60 overflow-auto rounded-[12px] bg-surface p-3 font-mono text-xs text-ink-muted">
                {files.slice(0, 100).map((f) => (
                  <li key={`${f.bucket_id}/${f.name}`}>
                    {f.bucket_id}/{f.name} · {formatBytes(Number(f.size_bytes || 0))}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <CleanOrphansButton count={files.length} />
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
