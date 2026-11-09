/**
 * Where a signed-in person goes, and which workspaces they can switch
 * between. Pure functions (no I/O) so every combination is unit-tested; the
 * inputs always come from the database (my_contexts), never from the browser,
 * apart from the remembered choice, which is only honoured when it is still
 * one of the person's workspaces.
 */
import { safeNextPath } from "@/lib/auth/redirects";

export type CompanyRole = "viewer" | "editor" | "company_admin";
export type AdminRole = "reviewer" | "admin" | "super_admin";

export type Contexts = {
  account_status: "active" | "suspended";
  student: { onboarding_completed: boolean } | null;
  admin_role: AdminRole | null;
  companies: { id: string; name: string; slug: string; status: "onboarding" | "active" | "suspended"; role: CompanyRole }[];
};

export type Workspace = {
  key: string;
  kind: "student" | "admin" | "company";
  label: string;
  detail: string;
  href: string;
};

export const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
  viewer: "Viewer",
  editor: "Editor",
  company_admin: "Company administrator",
};

const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  reviewer: "Reviewer",
  admin: "Administrator",
  super_admin: "Super administrator",
};

/** Every workspace the person can open, in a stable order: student, Handson admin, companies. */
export function listWorkspaces(c: Contexts): Workspace[] {
  if (c.account_status !== "active") return [];
  const out: Workspace[] = [];
  if (c.student) {
    out.push({
      key: "student",
      kind: "student",
      label: "Student profile",
      detail: c.student.onboarding_completed ? "Your profile and documents" : "Finish setting up your profile",
      href: c.student.onboarding_completed ? "/dashboard" : "/onboarding",
    });
  }
  if (c.admin_role) {
    out.push({ key: "admin", kind: "admin", label: "Handson admin", detail: ADMIN_ROLE_LABELS[c.admin_role], href: "/admin" });
  }
  for (const co of c.companies) {
    out.push({
      key: `company:${co.id}`,
      kind: "company",
      label: co.name,
      detail: co.status === "suspended" ? "Suspended" : COMPANY_ROLE_LABELS[co.role],
      href: `/employer/${co.id}`,
    });
  }
  return out;
}

/** The workspace a path belongs to, for highlighting the current one in the switcher. */
export function workspaceKeyForPath(pathname: string): string | null {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname === "/onboarding" || pathname.startsWith("/onboarding/")) {
    return "student";
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  const m = /^\/employer\/([0-9a-f-]{36})(\/|$)/.exec(pathname);
  return m ? `company:${m[1]}` : null;
}

/**
 * Where to send the person after sign-in (or when they open the site root).
 * Order: suspended → sign-out; a safe `next`; their remembered workspace if
 * still valid; Handson admin; their only workspace; otherwise the chooser.
 */
export function decideDestination(c: Contexts, opts: { next?: string | null; remembered?: string | null } = {}): string {
  if (c.account_status !== "active") return "/auth/signout?reason=suspended";
  const next = opts.next ? safeNextPath(opts.next, "") : "";
  if (next && next !== "/start") return next;

  const workspaces = listWorkspaces(c);
  const remembered = opts.remembered ? workspaces.find((w) => w.key === opts.remembered) : undefined;
  if (remembered) return remembered.href;

  const admin = workspaces.find((w) => w.kind === "admin");
  if (admin) return admin.href;
  if (workspaces.length === 1) return workspaces[0].href;
  return "/workspaces";
}
