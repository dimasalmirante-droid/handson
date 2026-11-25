"use client";

import { mergeFieldErrors } from "@/lib/forms/errors";
import { useState } from "react";
import { saveLinks } from "@/app/(app)/onboarding/actions";
import { SaveIndicator, StepFooter, useAutosave } from "@/components/onboarding/wizard";
import { DocumentManager } from "@/components/files/document-manager";
import { Field, Input, describedBy } from "@/components/ui/field";
import type { DocumentRecord } from "@/lib/data/student";
import type { FieldErrors } from "@/lib/validation/profile";
import { T, useT } from "@/i18n/client";

type Values = Record<string, string>;

export function DocumentsStep({ initial, documents, embedded = false }: { initial: Values; documents: DocumentRecord[]; embedded?: boolean }) {
  const t = useT();
  const [values, setValues] = useState<Values>(initial);
  const [fields, setFields] = useState<FieldErrors>({});
  const autosave = useAutosave((v: Values) => saveLinks(v, "draft"));
  const errors: FieldErrors = mergeFieldErrors(autosave.result?.ok === false ? autosave.result.fields : undefined, fields);

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
        placeholder={t(placeholder)}
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
        <h2 id="docs-heading" className="text-xl"><T>{"Documents"}</T></h2>
        <div className="mt-4">
          <DocumentManager documents={documents} requiredOnly={!embedded} />
        </div>
      </section>

      {!embedded && (
        <p className="mt-6 text-sm text-ink-muted">
          <T>{"Certificates, a cover letter and links to your work can be added from your profile at any time."}</T>
        </p>
      )}

      {embedded && (
      <section aria-labelledby="links-heading" className="mt-10">
        <h2 id="links-heading" className="text-xl"><T>{"Portfolio and online profiles"}</T></h2>
        <p className="mt-1 text-ink-muted"><T>{"Links help employers see your work. They save automatically."}</T></p>
        <div className="mt-6 grid gap-x-5 gap-y-6 sm:grid-cols-2">
          {link("linkedinUrl", "LinkedIn", "linkedin.com/in/your-name")}
          {link("githubUrl", "GitHub", "github.com/your-username")}
          <div className="sm:col-span-2">{link("portfolioUrl", "Portfolio or personal website", "your-site.com")}</div>
        </div>
      </section>
      )}

      {embedded ? (

        <div className="mt-6"><SaveIndicator status={autosave.status} /></div>

      ) : (
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

      )}
    </div>
  );
}
