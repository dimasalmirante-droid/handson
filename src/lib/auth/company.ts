import "server-only";
import { notFound } from "next/navigation";
import { getContexts } from "@/lib/auth/contexts";
import type { CompanyRole, Contexts } from "@/lib/auth/destination";
import { requireUser, type CurrentUser } from "@/lib/auth/session";

const RANK: Record<CompanyRole, number> = { viewer: 1, editor: 2, company_admin: 3 };

export function companyRoleAtLeast(role: CompanyRole | null | undefined, min: CompanyRole): boolean {
  return !!role && RANK[role] >= RANK[min];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Use at the top of every employer page, route and action. People who are
 * not members of the company (with at least `min` role) get a 404, so the
 * workspace's existence is not revealed. The database enforces the same
 * rules again through Row Level Security and its functions.
 */
export async function requireCompanyRole(
  companyId: string,
  min: CompanyRole = "viewer",
): Promise<{ user: CurrentUser; company: Contexts["companies"][number] }> {
  if (!UUID.test(companyId)) notFound();
  const user = await requireUser(`/employer/${companyId}`);
  const contexts = await getContexts();
  const company = contexts?.companies.find((c) => c.id === companyId);
  if (!company || !companyRoleAtLeast(company.role, min)) notFound();
  return { user, company };
}
