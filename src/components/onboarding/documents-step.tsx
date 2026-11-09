"use client";

import { useState } from "react";
import { saveLinks } from "@/app/(app)/onboarding/actions";
import { StepFooter, useAutosave } from "@/components/onboarding/wizard";
import { DocumentManager } from "@/components/files/document-manager";
import { Field, Input, describedBy } from "@/components/ui/field";
import type { DocumentRecord } from "@/lib/data/student";
import type { FieldErrors } from "@/lib/validation/profile";

type Values = Record<string, string>;

export function DocumentsStep({ initial, documents }: { initial: Values; documents: DocumentRecord[] }) {
  const [values, setValues] = useState<Values>(initial);
  const [fields, setFields] = useState<FieldErrors>({});
  const autosave = useAutosave((v: Values) => saveLinks(v, "draft"));
  const errors: FieldErrors = { ...(autosave.result?.ok === false ? autosave.result.fields : {}), ...fields };

  const set = (k: string, v: string) => {
    const next = { ...values, [k]: v };
    setValues(next);
    setFields((f) => ({ ...f, [k]: undefined }));
    autosave.schedule(next);
  };

  const link = (id: string, label: string, placeholder: string) => (
    <Field id={id} label={label} hint="Optional" error={errors[id]}>
      <Input
        id={id}
        type="url"
        inputMode="url"
        placeholder={placeholder}
        value={values[id] ?? ""}
        onChange={(e) => set(id, e.target.value)}
        onBlur={() => autosave.flush()}
        aria-invalid={errors[id] ? true : undefined}
        aria-describedby={describedBy(id, { hint: true, error: errors[id] })}
      />
    </Field>
  );

  return (
    <div>
      <section aria-labelledby="docs-heading">
        <h2 id="docs-heading" className="text-xl">Documents</h2>
        <div className="mt-4">
          <DocumentManager documents={documents} />
        </div>
      </section>

      <section aria-labelledby="links-heading" className="mt-10">
        <h2 id="links-heading" className="text-xl">Portfolio and online profiles</h2>
        <p className="mt-1 text-ink-muted">Links help employers see your work. They save automatically.</p>
        <div className="mt-6 grid gap-x-5 gap-y-6 sm:grid-cols-2">
          {link("linkedinUrl", "LinkedIn", "linkedin.com/in/your-name")}
          {link("githubUrl", "GitHub", "github.com/your-username")}
          <div className="sm:col-span-2">{link("portfolioUrl", "Portfolio or personal website", "your-site.com")}</div>
        </div>
      </section>

      <StepFooter
        back="/onboarding/experience"
        status={autosave.status}
        continueLabel="Review my profile"
        onContinue={async () => {
          await autosave.flush();
          const r = await saveLinks(values, "continue");
          if (!r.ok) setFields(r.fields ?? {});
          return r;
        }}
      />
    </div>
  );
}
