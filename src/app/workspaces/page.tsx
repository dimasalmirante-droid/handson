import type { Metadata } from "next";
import { switchWorkspace } from "@/app/workspaces/actions";
import { signOutAction } from "@/app/(auth)/actions";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { CreateStudentProfileForm } from "@/components/workspaces/create-student-profile";
import { getContexts } from "@/lib/auth/contexts";
import { COMPANY_ROLE_LABELS, listWorkspaces, type CompanyRole } from "@/lib/auth/destination";
import { requireUser } from "@/lib/auth/session";
import { workspacesView } from "@/lib/auth/workspaces-view";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your workspaces" };

type PendingInvitation = { company_name: string; role: CompanyRole; expires_at: string };

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Maputo" });

export default async function WorkspacesPage() {
  const user = await requireUser("/workspaces");
  const contexts = await getContexts();
  const supabase = await createClient();
  const { data: invitations } = await supabase.rpc("my_pending_invitations");
  const pending = (invitations ?? []) as PendingInvitation[];
  const workspaces = contexts ? listWorkspaces(contexts) : [];
  const view = workspacesView({ workspaces, hasStudentProfile: !!contexts?.student, pendingInvitations: pending.length });

  return (
    <AppShell email={user.email} home="/workspaces" workspaces={workspaces}>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Your workspaces"
          lead={view.empty ? "Your account is ready. Choose how you want to use Handson." : "Choose where you want to go."}
        />
        <div className="flex flex-col gap-6">
          {workspaces.length > 0 && (
            <Panel title="Open a workspace">
              <ul className="flex flex-col gap-3">
                {workspaces.map((w) => (
                  <li key={w.key}>
                    <form action={switchWorkspace}>
                      <input type="hidden" name="workspace" value={w.key} />
                      <button
                        type="submit"
                        className="flex w-full items-center justify-between gap-4 rounded-[14px] border border-line px-4 py-3 text-left hover:border-indigo hover:bg-indigo-soft"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[17px] font-semibold">{w.label}</span>
                          <span className="block text-sm text-ink-muted">{w.detail}</span>
                        </span>
                        <span aria-hidden className="text-indigo">→</span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {view.showInvitations && (
            <Panel title="Invitations">
              <ul className="flex flex-col gap-3">
                {pending.map((inv, i) => (
                  <li key={i} className="rounded-[14px] bg-surface px-4 py-3">
                    <p className="text-[17px] font-semibold">
                      Join {inv.company_name} <Badge tone="indigo">{COMPANY_ROLE_LABELS[inv.role]}</Badge>
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      You have been invited to this company&apos;s employer workspace. To accept, open the invitation link in your email on this
                      device. The invitation expires on {date(inv.expires_at)}.
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {view.showCreateStudentProfile && (
            <Panel title="Student profile">
              <p className="mb-4 text-[15px] text-ink-muted">
                Build your profile to find internships, traineeships and first jobs.
                {view.showInvitations && " This does not affect your invitation: you can still accept it afterwards."}
              </p>
              <CreateStudentProfileForm />
            </Panel>
          )}

          {!contexts && <Alert tone="warning">We could not load your workspaces. Please try again in a moment.</Alert>}

          <div>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost">Sign out</Button>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
