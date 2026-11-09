"use client";

import { useState } from "react";
import { saveLinks } from "@/app/(app)/onboarding/actions";
import { StepFooter, useAutosave } from "@/components/onboarding/wizard";
import { Alert, Badge } from "@/components/ui/feedback";
import { Field, Input, describedBy } from "@/components/ui/field";
import type { FieldErrors } from "@/lib/validation/profile";

type Values = Record<string, string>;

const DOCUMENTS = [
  { type: "cv", label: "CV", required: true, note: "Counts for 10% of your profile" },
  { type: "transcript", label: "Academic transcript", required: true, note: "Counts for 10% of your profile" },
  { type: "certificate", label: "Certificates", required: false, note: "Optional, you can add several" },
  { type: "cover_letter", label: "Cover letter", required: false, note: "Optional" },
];

export function DocumentsStep({ initial, uploaded }: { initial: Values; uploaded: string[] }) {
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
        <Alert tone="info" className="mt-4" title="Secure document upload is coming next">
          Uploads will be stored privately and only you and authorised Handson staff will be able to open them. You can finish
          your profile now and add documents as soon as uploads open.
        </Alert>
        <ul className="mt-4 divide-y divide-line rounded-[16px] border border-line">
          {DOCUMENTS.map((d) => (
            <li key={d.type} className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <p className="font-medium">
                  {d.label}
                  {d.required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
                </p>
                <p className="text-sm text-ink-muted">{d.note}</p>
              </div>
              {uploaded.includes(d.type) ? <Badge tone="success">Uploaded</Badge> : <Badge>Not uploaded</Badge>}
            </li>
          ))}
        </ul>
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
