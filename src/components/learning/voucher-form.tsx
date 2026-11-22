"use client";

import { useActionState } from "react";
import { redeemVoucher, type VoucherState } from "@/app/(app)/dashboard/learning/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, describedBy } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { useT } from "@/i18n/client";

/** "Have a code?" — opens a course paid for by a sponsor or partner. */
export function VoucherForm() {
  const t = useT();
  const [state, action, pending] = useActionState<VoucherState, FormData>(redeemVoucher, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      {state?.ok && <Alert tone="success">{t("Code accepted. The course is now open.")}</Alert>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field id="code" label="Access code" hint="From your institution, employer or Handson." error={state?.error ? t(state.error) : undefined} className="sm:w-80">
          <Input
            id="code"
            name="code"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="UEM-2026"
            aria-invalid={state?.error ? true : undefined}
            aria-describedby={describedBy("code", { hint: true, error: state?.error })}
          />
        </Field>
        <Button type="submit" variant="secondary" loading={pending}>{t("Use code")}</Button>
      </div>
    </form>
  );
}
