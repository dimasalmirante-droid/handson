import type { Workspace } from "@/lib/auth/destination";

/** What the /workspaces page shows. Pure, so the combinations are unit-tested. */
export function workspacesView(input: { workspaces: Workspace[]; hasStudentProfile: boolean; pendingInvitations: number }) {
  const hasCompanyWorkspace = input.workspaces.some((workspace) => workspace.kind === "company");
  const hasPendingEmployerInvitation = input.pendingInvitations > 0;

  return {
    empty: input.workspaces.length === 0,
    showInvitations: hasPendingEmployerInvitation,
    // Student registration is optional for employer users. Do not surface it
    // while an employer invitation is pending or after a company workspace
    // has been granted; the person can create a student profile separately.
    showCreateStudentProfile:
      !input.hasStudentProfile && !hasPendingEmployerInvitation && !hasCompanyWorkspace,
  };
}
