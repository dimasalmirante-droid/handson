"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createCompanyContract,
  terminateCompanyContract,
  type AdminResult,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";

export function CreateCompanyContractForm({ companyId }: { companyId: string }) {
  const [state, formAction, pending] = useActionState<AdminResult | null, FormData>(
    createCompanyContract.bind(null, companyId),
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="contract-reference" label="Contract reference" hint="Optional. Must be unique for this employer.">
          <Input id="contract-reference" name="reference" autoComplete="off" maxLength={120} />
        </Field>
        <Field id="contract-signed-on" label="Date signed" required>
          <Input id="contract-signed-on" name="signedOn" type="date" required />
        </Field>
        <Field id="contract-starts-on" label="Contract start date" required>
          <Input id="contract-starts-on" name="startsOn" type="date" required />
        </Field>
        <Field id="contract-ends-on" label="Contract end date" hint="Leave blank for an agreement with no fixed end date.">
          <Input id="contract-ends-on" name="endsOn" type="date" />
        </Field>
      </div>

      <Field
        id="contract-service-scope"
        label="Services covered"
        required
        hint="Summarise the services agreed with the employer. This is an internal record, not a replacement for the signed agreement."
      >
        <Textarea id="contract-service-scope" name="serviceScope" className="min-h-28" maxLength={5000} required />
      </Field>

      <Field
        id="contract-internal-note"
        label="Internal note"
        hint="Visible only to Handson administrators. Do not include passwords or unnecessary personal data."
      >
        <Textarea id="contract-internal-note" name="internalNote" className="min-h-20" maxLength={2000} />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-muted">
          Only register an agreement after it has been physically signed by the parties.
        </p>
        <Button type="submit" loading={pending}>Save signed contract</Button>
      </div>
    </form>
  );
}

export function ContractTerminationControl({
  companyId,
  contractId,
}: {
  companyId: string;
  contractId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<AdminResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col items-start gap-3">
      {!open && (
        <Button size="sm" variant="danger" disabled={pending} onClick={() => setOpen(true)}>
          Record early termination
        </Button>
      )}

      {open && (
        <div className="w-full rounded-[12px] bg-surface p-4">
          <p className="mb-3 text-sm text-ink-muted">
            This records that the signed agreement ended before its registered end date. The action is audited and cannot be repeated.
          </p>
          <Field id={"termination-reason-" + contractId} label="Reason for early termination" required>
            <Textarea
              id={"termination-reason-" + contractId}
              className="min-h-20"
              maxLength={500}
              minLength={3}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="danger"
              disabled={pending || reason.trim().length < 3}
              loading={pending}
              onClick={() => {
                if (!window.confirm("Record early termination for this signed contract?")) return;
                start(async () => {
                  const response = await terminateCompanyContract(companyId, contractId, reason);
                  setResult(response);
                  if (response.ok) setOpen(false);
                });
              }}
            >
              Confirm termination
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {result && <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert>}
    </div>
  );
}
