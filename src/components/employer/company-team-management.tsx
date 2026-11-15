"use client";

import { useActionState } from "react";
import {
  changeCompanyMemberRole,
  inviteCompanyMember,
  removeCompanyMember,
  resendCompanyInvitation,
  revokeCompanyInvitation,
  type CompanyTeamActionState,
} from "@/app/employer/[companyId]/team/actions";
import { Button } from "@/components/ui/button";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { COMPANY_ROLE_LABELS, type CompanyRole } from "@/lib/auth/destination";

type TeamMember = {
  user_id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  role: CompanyRole;
  joined_at: string;
};

type PendingInvitation = {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  role: CompanyRole;
  expires_at: string;
  last_sent_at: string | null;
  send_count: number;
  isExpired: boolean;
};

const dateTime = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Maputo",
  });

function ActionMessage({ state }: { state: CompanyTeamActionState }) {
  if (!state.message) return null;
  return <Alert tone={state.ok ? "success" : state.warning ? "warning" : "danger"}>{state.message}</Alert>;
}

export function CompanyTeamManagement({
  companyId,
  companyName,
  members,
  invitations,
  emailConfigured,
}: {
  companyId: string;
  companyName: string;
  members: TeamMember[];
  invitations: PendingInvitation[];
  emailConfigured: boolean;
}) {
  const [inviteState, inviteAction, inviting] = useActionState(inviteCompanyMember.bind(null, companyId), {});
  const [resendState, resendAction, resending] = useActionState(resendCompanyInvitation.bind(null, companyId), {});
  const [revokeState, revokeAction, revoking] = useActionState(revokeCompanyInvitation.bind(null, companyId), {});
  const [changeState, changeAction, changing] = useActionState(changeCompanyMemberRole.bind(null, companyId), {});
  const [removeState, removeAction, removing] = useActionState(removeCompanyMember.bind(null, companyId), {});

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5" aria-labelledby="team-invite-heading">
        <div>
          <h2 id="team-invite-heading" className="text-xl font-semibold">Invite a colleague</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Add people who need access to {companyName}&apos;s employer workspace. Each person uses their own Handson account.
          </p>
        </div>

        <ActionMessage state={inviteState} />

        {!emailConfigured && (
          <Alert tone="warning">
            Email sending is not configured for this environment. Add the server-side RESEND_API_KEY in Vercel before sending or resending invitations.
          </Alert>
        )}

        <form action={inviteAction} className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="team-invite-full-name" label="Colleague's full name" required>
              <Input id="team-invite-full-name" name="fullName" autoComplete="name" maxLength={200} required />
            </Field>
            <Field id="team-invite-job-title" label="Job title" hint="Optional. For example, HR Business Partner.">
              <Input id="team-invite-job-title" name="jobTitle" autoComplete="organization-title" maxLength={200} />
            </Field>
            <Field
              id="team-invite-email"
              label="Individual work email"
              required
              hint="Use the email address the colleague will use for their Handson account."
              className="sm:col-span-2"
            >
              <Input id="team-invite-email" name="email" type="email" autoComplete="email" maxLength={320} required />
            </Field>
            <Field
              id="team-invite-role"
              label="Workspace role"
              hint="Company Administrators can manage the team and company profile. Reviewers have read-only company access."
              className="sm:col-span-2"
            >
              <Select id="team-invite-role" name="role" defaultValue="reviewer">
                <option value="reviewer">Reviewer</option>
                <option value="company_admin">Company Administrator</option>
              </Select>
            </Field>
          </div>
          <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-sm text-ink-muted">
              Invitations expire after seven days. Access is granted only after the colleague accepts the invitation using the invited email address.
            </p>
            <Button type="submit" loading={inviting} disabled={!emailConfigured}>
              Send invitation
            </Button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-4 border-t border-line pt-8" aria-labelledby="team-members-heading">
        <div>
          <h2 id="team-members-heading" className="text-xl font-semibold">Team members</h2>
          <p className="mt-1 text-sm text-ink-muted">People who have accepted an invitation and currently belong to this workspace.</p>
        </div>
        <ActionMessage state={changeState} />
        <ActionMessage state={removeState} />

        {members.length === 0 ? (
          <EmptyState title="No team members found">A Company Administrator should appear here once the invitation has been accepted.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {members.map((member) => (
              <li key={member.user_id} className="rounded-[14px] border border-line bg-surface-raised p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-base font-semibold">{member.full_name || member.email}</h3>
                      <Badge tone={member.role === "company_admin" ? "indigo" : "neutral"}>
                        {COMPANY_ROLE_LABELS[member.role]}
                      </Badge>
                    </div>
                    <p className="mt-1 break-all text-sm text-ink-muted">{member.email}</p>
                    {member.job_title && <p className="mt-1 text-sm text-ink-muted">{member.job_title}</p>}
                    <p className="mt-2 text-xs text-ink-muted">Joined {dateTime(member.joined_at)}</p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <form action={changeAction} className="flex items-end gap-2">
                      <input type="hidden" name="userId" value={member.user_id} />
                      <Field id={"team-role-" + member.user_id} label="Access role">
                        <Select id={"team-role-" + member.user_id} name="role" defaultValue={member.role} className="min-w-48">
                          <option value="reviewer">Reviewer</option>
                          <option value="company_admin">Company Administrator</option>
                        </Select>
                      </Field>
                      <Button type="submit" variant="secondary" size="sm" loading={changing}>Save</Button>
                    </form>
                    <form
                      action={removeAction}
                      onSubmit={(event) => {
                        if (!window.confirm("Remove this person from the company workspace? They will lose access immediately.")) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="userId" value={member.user_id} />
                      <Button type="submit" variant="danger" size="sm" loading={removing}>Remove</Button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ink-muted">
          At least one Company Administrator must remain. Handson prevents the final Company Administrator from being demoted or removed.
        </p>
      </section>

      <section className="flex flex-col gap-4 border-t border-line pt-8" aria-labelledby="team-invitations-heading">
        <div>
          <h2 id="team-invitations-heading" className="text-xl font-semibold">Pending invitations</h2>
          <p className="mt-1 text-sm text-ink-muted">Invitations that have not yet been accepted.</p>
        </div>
        <ActionMessage state={resendState} />
        <ActionMessage state={revokeState} />

        {invitations.length === 0 ? (
          <EmptyState title="No pending invitations">New invitations will appear here until the colleague accepts, or the invitation expires or is revoked.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="rounded-[14px] border border-line bg-surface-raised p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-base font-semibold">{invitation.full_name || "Invited colleague"}</h3>
                      <Badge tone={invitation.isExpired ? "warning" : "indigo"}>
                        {invitation.isExpired ? "Expired" : "Awaiting acceptance"}
                      </Badge>
                      <Badge tone="neutral">{COMPANY_ROLE_LABELS[invitation.role]}</Badge>
                    </div>
                    <p className="mt-1 break-all text-sm text-ink-muted">{invitation.email}</p>
                    {invitation.job_title && <p className="mt-1 text-sm text-ink-muted">{invitation.job_title}</p>}
                    <p className="mt-2 text-xs text-ink-muted">
                      {invitation.last_sent_at
                        ? "Last email submitted " + dateTime(invitation.last_sent_at) + " · " + invitation.send_count + " send(s)"
                        : "Email not submitted yet"}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">Expires {dateTime(invitation.expires_at)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!invitation.isExpired && (
                      <form action={resendAction}>
                        <input type="hidden" name="invitationId" value={invitation.id} />
                        <Button type="submit" size="sm" variant="secondary" loading={resending} disabled={!emailConfigured}>
                          {invitation.last_sent_at ? "Resend invitation" : "Retry email"}
                        </Button>
                      </form>
                    )}
                    <form
                      action={revokeAction}
                      onSubmit={(event) => {
                        if (!window.confirm("Revoke this invitation? Its link will stop working immediately.")) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="invitationId" value={invitation.id} />
                      <Button type="submit" size="sm" variant="danger" loading={revoking}>Revoke</Button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
