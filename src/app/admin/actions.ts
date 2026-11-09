"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export type AdminResult = { ok: boolean; message: string };

const STATUSES = ["unverified", "pending", "verified", "rejected"] as const;
type Status = (typeof STATUSES)[number];
const isStatus = (v: string): v is Status => (STATUSES as readonly string[]).includes(v);
const isUuid = (v: string) => /^[0-9a-f-]{36}$/.test(v);
const note = (v?: string) => (v?.trim() ? v.trim().slice(0, 1000) : null);

function failure(error: { code?: string; message: string }, fallback: string): AdminResult {
  if (error.code === "42501") return { ok: false, message: "You do not have permission to do this." };
  if (error.code === "22023" || error.code === "P0002") return { ok: false, message: error.message };
  console.error("admin action failed", error.code, error.message);
  return { ok: false, message: fallback };
}

/* Every action re-checks the role here and again inside the database function, which also writes the audit log. */

export async function setProfileVerification(profileId: string, status: string, reason?: string): Promise<AdminResult> {
  await requireAdmin("reviewer");
  if (!isUuid(profileId) || !isStatus(status)) return { ok: false, message: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_profile_verification", { p_profile: profileId, p_status: status, p_note: note(reason) });
  if (error) return failure(error, "The profile status could not be updated.");
  revalidatePath(`/admin/students/${profileId}`);
  return { ok: true, message: "Profile status updated. The student has been notified where relevant." };
}

export async function setRecordVerification(
  table: "education_records" | "documents",
  id: string,
  profileId: string,
  status: string,
  reason?: string,
): Promise<AdminResult> {
  await requireAdmin("reviewer");
  if (!["education_records", "documents"].includes(table) || !isUuid(id) || !isStatus(status)) {
    return { ok: false, message: "Invalid request." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_record_verification", { p_table: table, p_id: id, p_status: status, p_note: note(reason) });
  if (error) return failure(error, "The record could not be updated.");
  revalidatePath(`/admin/students/${profileId}`);
  return { ok: true, message: "Status updated." };
}

export async function setAccountStatus(profileId: string, status: "active" | "suspended", reason: string): Promise<AdminResult> {
  await requireAdmin("admin");
  if (!isUuid(profileId) || !["active", "suspended"].includes(status)) return { ok: false, message: "Invalid request." };
  if (!reason.trim()) return { ok: false, message: "Enter a reason. It is recorded in the audit log." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_account_status", { p_profile: profileId, p_status: status, p_reason: reason.trim().slice(0, 500) });
  if (error) return failure(error, "The account could not be updated.");
  revalidatePath(`/admin/students/${profileId}`);
  return {
    ok: true,
    message: status === "suspended" ? "Account suspended. The student is signed out and cannot change their data." : "Account reactivated.",
  };
}

export async function setRole(_prev: AdminResult | null, formData: FormData): Promise<AdminResult> {
  await requireAdmin("super_admin");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: "Enter a valid email address." };
  if (!["reviewer", "admin", "super_admin", "revoke"].includes(role)) return { ok: false, message: "Choose a role." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", { p_email: email, p_role: role === "revoke" ? null : role, p_note: null });
  if (error) return failure(error, "The role could not be changed.");
  revalidatePath("/admin/team");
  return { ok: true, message: role === "revoke" ? `Administrator access removed for ${email}.` : `${email} now has the selected role.` };
}

export async function revokeRole(email: string): Promise<AdminResult> {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("role", "revoke");
  return setRole(null, fd);
}

/** Remove files that were uploaded but never recorded (super admins). Referenced files are protected by the database. */
export async function cleanOrphanedFiles(): Promise<AdminResult> {
  await requireAdmin("super_admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_orphaned_files");
  if (error) return failure(error, "Orphaned files could not be listed.");
  const files = (data ?? []) as { bucket_id: string; name: string; size_bytes: number }[];
  if (files.length === 0) return { ok: true, message: "No orphaned files found." };

  let removed = 0;
  for (const bucket of ["documents", "avatars"]) {
    const names = files.filter((f) => f.bucket_id === bucket).map((f) => f.name);
    if (!names.length) continue;
    const { data: out, error: rmError } = await supabase.storage.from(bucket).remove(names);
    if (rmError) console.error("orphan removal failed", bucket, rmError.message);
    removed += out?.length ?? 0;
  }
  const bytes = files.reduce((n, f) => n + Number(f.size_bytes || 0), 0);
  await supabase.rpc("log_admin_action", {
    p_action: "storage.orphans_removed",
    p_target_table: "storage.objects",
    p_target_id: null,
    p_metadata: { found: files.length, removed, bytes },
  });
  revalidatePath("/admin/maintenance");
  return { ok: removed === files.length, message: `Removed ${removed} of ${files.length} orphaned files.` };
}
