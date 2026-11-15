"use client";

import { useActionState } from "react";
import { createCompany } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";

type CompanyStatus = "onboarding" | "active" | "suspended";

const STATUS: Record<CompanyStatus, { label: string; tone: "indigo" | "success" | "danger" }> = {
  onboarding: { label: "Onboarding", tone: "indigo" },
  active: { label: "Active", tone: "success" },
  suspended: { label: "Suspended", tone: "danger" },
};

export function CompanyStatusBadge({ status }: { status: string }) {
  const config = STATUS[status as CompanyStatus] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function CreateCompanyForm() {
  const [state, action, pending] = useActionState(createCompany, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="company-name" label="Company name" required hint="Use the employer's official or commonly recognised name.">
          <Input id="company-name" name="name" autoComplete="organization" maxLength={200} required />
        </Field>
        <Field
          id="company-slug"
          label="Public page slug"
          required
          hint="Reserved for the future Employer Page. It will not be published yet."
        >
          <Input id="company-slug" name="slug" autoComplete="off" maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
        </Field>
      </div>
      <Field
        id="company-contact-email"
        label="Official company contact email"
        hint="Optional. Use a shared company inbox (for example, HR). This is company correspondence, not a sign-in email."
        className="max-w-xl"
      >
        <Input
          id="company-contact-email"
          name="contactEmail"
          type="email"
          autoComplete="email"
          maxLength={320}
        />
      </Field>
      <Field
        id="company-note"
        label="Internal onboarding note"
        hint="Visible only to Handson administrators. Do not add passwords or sensitive personal data."
      >
        <Textarea id="company-note" name="note" className="min-h-24" maxLength={5000} />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-lg text-sm text-ink-muted">
          The employer will be created in onboarding status. This does not invite its team or publish its public page.
        </p>
        <Button type="submit" loading={pending}>Register employer</Button>
      </div>
    </form>
  );
}
