"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { changeEmail, changePassword, setEmployerVisibility, type SettingsResult } from "@/app/(app)/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, describedBy } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Employer visibility                                                 */
/* ------------------------------------------------------------------ */

export function VisibilityToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, start] = useTransition();

  const apply = (next: boolean) =>
    start(async () => {
      const r = await setEmployerVisibility(next);
      setResult(r);
      if (r.ok) setOn(next);
      setConfirming(false);
    });

  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <div>
          <p id="visibility-label" className="font-semibold">Allow verified employers to view my profile</p>
          <p id="visibility-desc" className="mt-1 text-[15px] text-ink-muted">
            {on
              ? "Your profile can be shown to verified employers looking for interns and graduates. Your documents are shared only when you apply or accept a request."
              : "Your profile is private. Only you and authorised Handson staff can see it."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="visibility-label"
          aria-describedby="visibility-desc"
          disabled={pending}
          onClick={() => (on ? apply(false) : setConfirming(true))}
          className={cn(
            "relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60",
            on ? "bg-indigo" : "bg-line-strong",
          )}
        >
          <span className={cn("absolute top-1 size-6 rounded-full bg-white shadow transition-[left]", on ? "left-7" : "left-1")} />
        </button>
      </div>

      {confirming && (
        <div className="mt-5 rounded-[14px] border-[1.5px] border-indigo/30 bg-indigo-soft/40 p-4 sm:p-5">
          <p className="font-semibold">Before you turn this on</p>
          <ul className="mt-2 list-disc pl-5 text-[15px] text-ink-muted">
            <li>Verified employers will be able to see your name, education, skills, interests, experience and province.</li>
            <li>Your phone number, email, date of birth and documents are not shown until you choose to share them.</li>
            <li>You can turn this off at any time. We keep a record of each change.</li>
          </ul>
          <p className="mt-3 text-sm text-ink-muted">
            Employer access is not available yet. Turning this on now means your profile is ready when it opens.
          </p>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button loading={pending} onClick={() => apply(true)}>I agree, make my profile visible</Button>
          </div>
        </div>
      )}

      {result && <Alert tone={result.ok ? "success" : "danger"} className="mt-4">{result.message}</Alert>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Account                                                             */
/* ------------------------------------------------------------------ */

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{children}</Button>;
}

const empty: SettingsResult = { ok: false };

export function EmailForm({ current }: { current: string }) {
  const [state, action] = useActionState(changeEmail, empty);
  const err = state.fields?.email;
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <p className="text-[15px]">
        Current email: <strong>{current}</strong>
      </p>
      {state.message && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
      <Field id="email" label="New email address" error={err}>
        <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={err ? true : undefined} aria-describedby={describedBy("email", { error: err })} />
      </Field>
      <div><Submit>Change email</Submit></div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, empty);
  const f = state.fields ?? {};
  const field = (id: string, label: string, autoComplete: string, hint?: string) => (
    <Field id={id} label={label} hint={hint} error={f[id]}>
      <Input id={id} name={id} type="password" autoComplete={autoComplete} aria-invalid={f[id] ? true : undefined} aria-describedby={describedBy(id, { hint, error: f[id] })} />
    </Field>
  );
  return (
    <form action={action} noValidate className="flex flex-col gap-4" key={state.ok ? "done" : "form"}>
      {state.message && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
      {field("currentPassword", "Current password", "current-password")}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("newPassword", "New password", "new-password", "At least 8 characters, including a letter and a number.")}
        {field("confirmPassword", "Confirm new password", "new-password")}
      </div>
      <div><Submit>Change password</Submit></div>
    </form>
  );
}
