import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { getMessages } from "@/i18n/get-messages";

export const metadata: Metadata = { title: "Log in" };

/**
 * Phase 1: layout and design only. Authentication is connected in Phase 2,
 * so every control is disabled and the page says so.
 */
export default async function LoginPage() {
  const t = await getMessages();
  const a = t.auth;

  return (
    <div>
      <h1 className="text-[36px] tracking-[-0.03em]">{a.login.title}</h1>
      <p className="mt-2 text-ink-muted">{a.login.lead}</p>

      <Alert tone="info" className="mt-6">
        {a.comingSoon}
      </Alert>

      <fieldset disabled className="mt-6 flex flex-col gap-5">
        <legend className="sr-only">{a.login.title}</legend>
        <GoogleButton>{a.continueWithGoogle}</GoogleButton>
        <div className="flex items-center gap-3 text-sm text-ink-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
          {a.or}
        </div>
        <Field id="email" label={a.email} required>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field id="password" label={a.password} required>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" fullWidth>
          {a.login.submit}
        </Button>
      </fieldset>

      <p className="mt-4 text-sm">
        <span className="text-ink-muted">{a.login.forgot}</span>
      </p>
      <p className="mt-8 text-[15px] text-ink-muted">
        {a.login.noAccount}{" "}
        <Link href="/register" className="font-semibold text-indigo hover:underline">
          {a.login.createAccount}
        </Link>
      </p>
    </div>
  );
}
