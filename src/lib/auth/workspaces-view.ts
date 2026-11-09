import type { Workspace } from "@/lib/auth/destination";

/** What the /workspaces page shows. Pure, so the combinations are unit-tested. */
export function workspacesView(input: { workspaces: Workspace[]; hasStudentProfile: boolean; pendingInvitations: number }) {
  return {
    empty: input.workspaces.length === 0,
    showInvitations: input.pendingInvitations > 0,
    // Anyone without a student profile can create one, invitation or not.
    showCreateStudentProfile: !input.hasStudentProfile,
  };
}
