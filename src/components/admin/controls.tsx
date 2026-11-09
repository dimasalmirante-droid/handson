"use client";

import { useActionState, useState, useTransition } from "react";
import { revokeRole, setAccountStatus, setProfileVerification, setRecordVerification, setRole, type AdminResult } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

const STATUS_BADGE = {
  unverified: { tone: "neutral", label: "Not verified" },
  pending: { tone: "indigo", label: "Pending review" },
  verified: { tone: "success", label: "Verified" },
  rejected: { tone: "danger", label: "Rejected" },
} as const;

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status as keyof typeof STATUS_BADGE] ?? STATUS_BADGE.unverified;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

type Target = { kind: "profile"; profileId: string } | { kind: "education_records" | "documents"; id: string; profileId: string };

/** Verify / reject / mark pending, with an optional note sent to the student on rejection. */
export function VerifyControls({ target, current, compact }: { target: Target; current: string; compact?: boolean }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<AdminResult | null>(null);
  const [pending, start] = useTransition();

  const apply = (status: string, note?: string) =>
    start(async () => {
      const r =
        target.kind === "profile"
          ? await setProfileVerification(target.profileId, status, note)
          : await setRecordVerification(target.kind, target.id, target.profileId, status, note);
      setResult(r);
      if (r.ok) {
        setRejecting(false);
        setReason("");
      }
    });

  return (
    <div className={compact ? "" : "flex flex-col gap-3"}>
      <div className="flex flex-wrap items-center gap-2">
        {current !== "verified" && <Button size="sm" disabled={pending} onClick={() => apply("verified")}>Verify</Button>}
        {current !== "rejected" && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => setRejecting((v) => !v)}>Reject</Button>
        )}
        {target.kind === "profile" && current !== "pending" && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => apply("pending")}>Mark as under review</Button>
        )}
        {current !== "unverified" && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => apply("unverified")}>Reset</Button>
        )}
      </div>
      {rejecting && (
        <div className="mt-3 flex flex-col gap-2 rounded-[12px] bg-surface p-3">
          <Field id={`reason-${target.kind}-${"id" in target ? target.id : target.profileId}`} label="Message to the student" hint="Explain what needs to change. The student sees this in their notifications.">
            <Textarea
              id={`reason-${target.kind}-${"id" in target ? target.id : target.profileId}`}
              className="min-h-20"
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" variant="danger" loading={pending} onClick={() => apply("rejected", reason)}>Confirm rejection</Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {result && <Alert tone={result.ok ? "success" : "danger"} className="mt-2">{result.message}</Alert>}
    </div>
  );
}

/** Suspend or reactivate an account; a reason is required and audited. */
export function AccountControls({ profileId, status }: { profileId: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<AdminResult | null>(null);
  const [pending, start] = useTransition();
  const suspended = status === "suspended";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {suspended ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>}
        <Button size="sm" variant={suspended ? "primary" : "danger"} onClick={() => setOpen((v) => !v)}>
          {suspended ? "Reactivate account" : "Suspend account"}
        </Button>
      </div>
      {open && (
        <div className="flex flex-col gap-2 rounded-[12px] bg-surface p-3">
          <p className="text-sm text-ink-muted">
            {suspended
              ? "The student will be able to sign in and edit their profile again."
              : "The student will be signed out and will not be able to change any data. Their records are kept."}
          </p>
          <Field id="account-reason" label="Reason (recorded in the audit log)" required>
            <Textarea id="account-reason" className="min-h-20" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={suspended ? "primary" : "danger"}
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await setAccountStatus(profileId, suspended ? "active" : "suspended", reason);
                  setResult(r);
                  if (r.ok) {
                    setOpen(false);
                    setReason("");
                  }
                })
              }
            >
              Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {result && <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert>}
    </div>
  );
}

/** Grant a role to an existing account by email. */
export function GrantRoleForm() {
  const [state, action, pending] = useActionState(setRole, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
        <Field id="grant-email" label="Email of an existing Handson account" required>
          <Input id="grant-email" name="email" type="email" required />
        </Field>
        <Field id="grant-role" label="Role" required>
          <Select id="grant-role" name="role" defaultValue="reviewer">
            <option value="reviewer">Reviewer</option>
            <option value="admin">Administrator</option>
            <option value="super_admin">Super administrator</option>
          </Select>
        </Field>
        <Button type="submit" loading={pending}>Grant access</Button>
      </div>
    </form>
  );
}

export function RevokeButton({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Remove administrator access for ${email}?`)) return;
          start(async () => {
            const r = await revokeRole(email);
            if (!r.ok) setError(r.message);
          });
        }}
      >
        Remove access
      </Button>
      {error && <span className="text-sm text-danger">{error}</span>}
    </span>
  );
}
