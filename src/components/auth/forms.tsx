"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  forgotPasswordAction,
  googleAction,
  loginAction,
  registerAction,
  resetPasswordAction,
  type FormState,
} from "@/app/(auth)/actions";
import { GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Checkbox, Field, Input, describedBy } from "@/components/ui/field";
import { PASSWORD_MIN } from "@/lib/validation/auth";

const initial: FormState = {};

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth loading={pending}>
      {children}
    </Button>
  );
}

function GoogleSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <GoogleButton type="submit" disabled={pending} aria-busy={pending || undefined}>
      {pending ? "Redirecting to Google…" : label}
    </GoogleButton>
  );
}

/** "Continue with Google" — a separate form so it never submits the email form. */
export function GoogleForm({ label, next, intent }: { label: string; next?: string; intent?: "student" }) {
  return (
    <form action={googleAction}>
      {next && <input type="hidden" name="next" value={next} />}
      {intent && <input type="hidden" name="intent" value={intent} />}
      <GoogleSubmit label={label} />
    </form>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-ink-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
      {label}
    </div>
  );
}

function TextField(props: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  defaultValue?: string;
  minLength?: number;
}) {
  const { id, label, hint, error, required, ...input } = props;
  return (
    <Field id={id} label={label} required={required} hint={hint} error={error}>
      <Input
        id={id}
        name={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, { hint, error })}
        {...input}
      />
    </Field>
  );
}

/* ------------------------------------------------------------------ */

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, initial);
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}
      <TextField id="email" label="Email address" type="email" autoComplete="email" required
        defaultValue={state.values?.email} error={state.fields?.email} />
      <TextField id="password" label="Password" type="password" autoComplete="current-password" required
        error={state.fields?.password} />
      <div className="-mt-2 text-right">
        <Link href="/forgot-password" className="text-sm font-semibold text-indigo hover:underline">
          Forgot your password?
        </Link>
      </div>
      <Submit>Log in</Submit>
    </form>
  );
}

export type RegisterLegal = {
  terms: { id: string; version: string; href: string };
  privacy: { id: string; version: string; href: string };
} | null;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-danger">
      {message}
    </p>
  );
}

const linkClass = "font-semibold text-indigo hover:underline";

/**
 * Email registration. Before final legal documents are in force, one
 * checkbox covers the Terms and Privacy Policy (as before) and nothing is
 * recorded against a version. Once they are in force, the current versions
 * are named and Terms acceptance and Privacy Notice acknowledgement are
 * separate checkboxes.
 */
export function RegisterForm({ termsUrl, privacyUrl, legal, next }: { termsUrl: string; privacyUrl: string; legal?: RegisterLegal; next?: string }) {
  const [state, action] = useActionState(registerAction, initial);
  const termsError = state.fields?.acceptTerms;
  const privacyError = state.fields?.acknowledgePrivacy;
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField id="firstName" label="First name" autoComplete="given-name" required
          defaultValue={state.values?.firstName} error={state.fields?.firstName} />
        <TextField id="surname" label="Surname" autoComplete="family-name" required
          defaultValue={state.values?.surname} error={state.fields?.surname} />
      </div>
      <TextField id="email" label="Email address" type="email" autoComplete="email" required
        defaultValue={state.values?.email} error={state.fields?.email} />
      <TextField id="password" label="Password" type="password" autoComplete="new-password" required
        minLength={PASSWORD_MIN} hint={`At least ${PASSWORD_MIN} characters, including a letter and a number.`}
        error={state.fields?.password} />
      {legal ? (
        <div className="flex flex-col gap-3">
          <input type="hidden" name="legalTermsId" value={legal.terms.id} />
          <input type="hidden" name="legalPrivacyId" value={legal.privacy.id} />
          <div>
            <Checkbox
              id="acceptTerms"
              name="acceptTerms"
              required
              aria-invalid={termsError ? true : undefined}
              aria-describedby={termsError ? "acceptTerms-error" : undefined}
              label={
                <>
                  I accept the{" "}
                  <a href={legal.terms.href} target="_blank" rel="noopener" className={linkClass}>
                    Terms and Conditions
                  </a>{" "}
                  (version {legal.terms.version}).
                </>
              }
            />
            <FieldError id="acceptTerms" message={termsError} />
          </div>
          <div>
            <Checkbox
              id="acknowledgePrivacy"
              name="acknowledgePrivacy"
              required
              aria-invalid={privacyError ? true : undefined}
              aria-describedby={privacyError ? "acknowledgePrivacy-error" : undefined}
              label={
                <>
                  I have read and acknowledge the{" "}
                  <a href={legal.privacy.href} target="_blank" rel="noopener" className={linkClass}>
                    Privacy Notice
                  </a>{" "}
                  (version {legal.privacy.version}).
                </>
              }
            />
            <FieldError id="acknowledgePrivacy" message={privacyError} />
          </div>
        </div>
      ) : (
        <div>
          <Checkbox
            id="acceptTerms"
            name="acceptTerms"
            required
            aria-invalid={termsError ? true : undefined}
            aria-describedby={termsError ? "acceptTerms-error" : undefined}
            label={
              <>
                I agree to the{" "}
                <a href={termsUrl} target="_blank" rel="noopener" className={linkClass}>
                  Terms and Conditions
                </a>{" "}
                and have read the{" "}
                <a href={privacyUrl} target="_blank" rel="noopener" className={linkClass}>
                  Privacy Policy
                </a>
                .
              </>
            }
          />
          <FieldError id="acceptTerms" message={termsError} />
        </div>
      )}
      <Submit>Create account</Submit>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initial);
  if (state.success) {
    return (
      <Alert tone="success" title="Check your email">
        {state.success}
      </Alert>
    );
  }
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <TextField id="email" label="Email address" type="email" autoComplete="email" required
        defaultValue={state.values?.email} error={state.fields?.email} />
      <Submit>Send reset link</Submit>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPasswordAction, initial);
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <TextField id="password" label="New password" type="password" autoComplete="new-password" required
        minLength={PASSWORD_MIN} hint={`At least ${PASSWORD_MIN} characters, including a letter and a number.`}
        error={state.fields?.password} />
      <TextField id="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" required
        error={state.fields?.confirmPassword} />
      <Submit>Save new password</Submit>
    </form>
  );
}
