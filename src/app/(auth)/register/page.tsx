import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { getMessages } from "@/i18n/get-messages";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Create your account" };

/**
 * Phase 1: layout and design only. Registration is connected in Phase 2,
 * so every control is disabled and the page says so.
 */
export default async function RegisterPage() {
  const t = await getMessages();
  const a = t.auth;

  return (
    <div>
      <h1 className="text-[36px] tracking-[-0.03em]">{a.register.title}</h1>
      <p className="mt-2 text-ink-muted">{a.register.lead}</p>

      <Alert tone="info" className="mt-6">
        {a.comingSoon}
      </Alert>

      <fieldset disabled className="mt-6 flex flex-col gap-5">
        <legend className="sr-only">{a.register.title}</legend>
        <GoogleButton>{a.continueWithGoogle}</GoogleButton>
        <div className="flex items-center gap-3 text-sm text-ink-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
          {a.or}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="firstName" label={a.firstName} required>
            <Input id="firstName" name="firstName" autoComplete="given-name" required />
          </Field>
          <Field id="surname" label={a.surname} required>
            <Input id="surname" name="surname" autoComplete="family-name" required />
          </Field>
        </div>
        <Field id="email" label={a.email} required>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field id="password" label={a.password} required hint={a.passwordHint}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            aria-describedby="password-hint"
          />
        </Field>
        <Button type="submit" fullWidth>
          {a.register.submit}
        </Button>
      </fieldset>

      <p className="mt-4 text-sm text-ink-muted">
        By creating an account you agree to the{" "}
        <a className="font-medium text-indigo hover:underline" href={site.links.terms}>
          {t.common.terms}
        </a>{" "}
        and acknowledge the{" "}
        <a className="font-medium text-indigo hover:underline" href={site.links.privacy}>
          {t.common.privacy}
        </a>
        .
      </p>
      <p className="mt-8 text-[15px] text-ink-muted">
        {a.register.hasAccount}{" "}
        <Link href="/login" className="font-semibold text-indigo hover:underline">
          {a.register.logIn}
        </Link>
      </p>
    </div>
  );
}
