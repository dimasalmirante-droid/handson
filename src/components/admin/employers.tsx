"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { createCompany } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { suggestCompanySlug } from "@/lib/companies/slug";

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
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  function handleCompanyNameChange(event: ChangeEvent<HTMLInputElement>) {
    const nextName = event.currentTarget.value;
    setCompanyName(nextName);
    if (!slugManuallyEdited) setSlug(suggestCompanySlug(nextName));
  }

  function handleSlugChange(event: ChangeEvent<HTMLInputElement>) {
    const nextSlug = event.currentTarget.value;
    setSlug(nextSlug);
    setSlugManuallyEdited(nextSlug !== suggestCompanySlug(companyName));
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {state && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="company-name" label="Company name" required hint="Use the employer's official or commonly recognised name.">
          <Input
            id="company-name"
            name="name"
            autoComplete="organization"
            maxLength={200}
            required
            value={companyName}
            onChange={handleCompanyNameChange}
          />
        </Field>
        <Field
          id="company-slug"
          label="Public page slug"
          required
          hint="Suggested from the company name. You can edit it; once customized, it stays unchanged when the name changes. The page will not be published yet."
        >
          <Input
            id="company-slug"
            name="slug"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={80}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            required
            value={slug}
            onChange={handleSlugChange}
          />
        </Field>
      </div>
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
