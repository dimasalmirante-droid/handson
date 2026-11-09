import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type AdminRole = "reviewer" | "admin" | "super_admin";

const RANK: Record<AdminRole, number> = { reviewer: 1, admin: 2, super_admin: 3 };

export const ROLE_LABELS: Record<AdminRole, string> = {
  reviewer: "Reviewer",
  admin: "Administrator",
  super_admin: "Super administrator",
};

export function roleAtLeast(role: AdminRole | null, min: AdminRole): boolean {
  return !!role && RANK[role] >= RANK[min];
}

/**
 * The signed-in user's active administrator role, read from the database.
 * Row Level Security only returns role rows to administrators, so a student
 * always gets null. Never derived from anything the browser sends.
 */
export const getAdminRole = cache(async (userId: string): Promise<AdminRole | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("administrator_roles")
    .select("role")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  return (data?.role as AdminRole | undefined) ?? null;
});

/**
 * Use at the top of every admin page, route and action. Non-administrators
 * get a 404, so the admin area's existence is not revealed. The database
 * enforces the same rules again in every admin function.
 */
export async function requireAdmin(min: AdminRole = "reviewer"): Promise<{ user: CurrentUser; role: AdminRole }> {
  const user = await requireUser("/admin");
  const role = await getAdminRole(user.id);
  if (!roleAtLeast(role, min)) notFound();
  return { user, role: role! };
}
