"use client";

import { useActionState } from "react";
import {
  createFirstCompanyAdminInvitation,
  resendFirstCompanyAdminInvitation,
  revokeFirstCompanyAdminInvitation,
  type CompanyAdminInvitationActionState,
} from "@/app/admin/employers/[companyId]/administrator/actions";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";

type Invitation = {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  last_sent_at: string | null;
  send_count: number;
};

type CompanyAdminMember = {
  full_name: string | null;
  job_title: string | null;
  created_at: string;
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

function ActionMessage({ state }: { state: CompanyAdminInvitationActionState }) {
  if (!state.message) return null;
  return <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>;
}

export function CompanyAdminInvitationPanel({
  companyId,
  companyStatus,
  emailConfigured,
  currentAdmin,
  invitation,
}: {
  companyId: string;
  companyStatus: string;
  emailConfigured: boolean;
  currentAdmin: CompanyAdminMember | null;
  invitation: Invitation | null;
}) {
  const [createState, createAction, creating] = useActionState(
    createFirstCompanyAdminInvitation.bind(null, companyId),
    {},
  );
  const [resendState, resendAction, resending] = useActionState(
    resendFirstCompanyAdminInvitation.bind(null, companyId),
    {},
  );
  const [revokeState, revokeAction, revoking] = useActionState(
    revokeFirstCompanyAdminInvitation.bind(null, companyId),
    {},
  );

  const activeInvitation = invitation?.status === "pending" ? invitation : null;

  return (
    <div className="flex flex-col gap-5">
      <ActionMessage state={createState} />
      <ActionMessage state={resendState} />
      <ActionMessage state={revokeState} />

      {companyStatus === "suspended" && (
        <Alert tone="danger">This employer is suspended. A Company Administrator cannot be appointed while the workspace is suspended.</Alert>
      )}

      {currentAdmin ? (
        <div className="rounded-[14px] border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">Active</Badge>
            <span className="text-sm text-ink-muted">Company Administrator</span>
          </div>
          <h3 className="mt-3 text-lg font-semibold">{currentAdmin.full_name || "Company Administrator"}</h3>
          {currentAdmin.job_title && <p className="mt-1 text-sm text-ink-muted">{currentAdmin.job_title}</p>}
          <p className="mt-3 text-sm text-ink-muted">Joined {dateTime(currentAdmin.created_at)}</p>
          <p className="mt-4 text-sm text-ink-muted">
            This person now manages the employer workspace using their existing Handson account.
          </p>
        </div>
      ) : activeInvitation ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-[14px] border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="indigo">Invitation on file</Badge>
              {activeInvitation.last_sent_at ? (
                <Badge tone="success">Email submitted</Badge>
              ) : (
                <Badge tone="warning">Email not submitted yet</Badge>
              )}
            </div>
            <h3 className="mt-3 text-lg font-semibold">{activeInvitation.full_name || "First Company Administrator"}</h3>
            {activeInvitation.job_title && <p className="mt-1 text-sm text-ink-muted">{activeInvitation.job_title}</p>}
            <p className="mt-3 text-sm">{activeInvitation.email}</p>
            <p className="mt-1 text-sm text-ink-muted">Expires {dateTime(activeInvitation.expires_at)}</p>
            {activeInvitation.last_sent_at && (
              <p className="mt-1 text-sm text-ink-muted">Last email submitted {dateTime(activeInvitation.last_sent_at)}</p>
            )}
          </div>

          {!emailConfigured && (
            <Alert tone="warning">
              Email sending is not configured for this environment. Add the server-side RESEND_API_KEY in Vercel before retrying.
            </Alert>
          )}

          <div className="flex flex-wrap gap-3">
            <form action={resendAction}>
              <input type="hidden" name="invitationId" value={activeInvitation.id} />
              <Button type="submit" loading={resending} disabled={!emailConfigured || companyStatus === "suspended"}>
                {activeInvitation.last_sent_at ? "Resend / replace invitation" : "Retry email"}
              </Button>
            </form>
            <form
              action={revokeAction}
              onSubmit={(event) => {
                if (!window.confirm("Revoke this invitation? The link will stop working immediately.")) event.preventDefault();
              }}
            >
              <input type="hidden" name="invitationId" value={activeInvitation.id} />
              <Button type="submit" variant="danger" loading={revoking} disabled={companyStatus === "suspended"}>
                Revoke invitation
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <form action={createAction} className="flex flex-col gap-4">
          {invitation && (
            <Alert tone="warning">
              The previous first-administrator invitation is {invitation.status === "pending" ? "expired" : invitation.status}. You can appoint a new administrator below.
            </Alert>
          )}
          {!emailConfigured && (
            <Alert tone="warning">
              Email sending is not configured for this environment. Add the server-side RESEND_API_KEY in Vercel before sending an invitation.
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="first-admin-full-name" label="Administrator's full name" required>
              <Input id="first-admin-full-name" name="fullName" autoComplete="name" maxLength={200} required />
            </Field>
            <Field id="first-admin-job-title" label="Job title" hint="Optional. For example, HR Manager.">
              <Input id="first-admin-job-title" name="jobTitle" autoComplete="organization-title" maxLength={200} />
            </Field>
          </div>
          <Field
            id="first-admin-email"
            label="Individual work email"
            required
            hint="This is the person's own Handson sign-in email, not a shared company inbox."
          >
            <Input id="first-admin-email" name="email" type="email" autoComplete="email" maxLength={320} required />
          </Field>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-sm text-ink-muted">
              The invitation expires after seven days. Handson will not create a user account or grant company access until this person accepts it.
            </p>
            <Button type="submit" loading={creating} disabled={!emailConfigured || companyStatus === "suspended"}>
              Send invitation
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
