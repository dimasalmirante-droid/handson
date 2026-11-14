"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { acceptLegalAction, type AcceptState } from "@/app/legal/accept/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Checkbox } from "@/components/ui/field";

type Doc = { id: string; kind: "terms" | "privacy"; version: string; title: string; summary: string | null; effective: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Continue
    </Button>
  );
}

/** One checkbox per document that needs action: Terms are accepted, the Privacy Notice is acknowledged. */
export function AcceptLegalForm({ documents, next }: { documents: Doc[]; next?: string }) {
  const [state, action] = useActionState<AcceptState, FormData>(acceptLegalAction, {});
  const terms = documents.find((d) => d.kind === "terms");
  const privacy = documents.find((d) => d.kind === "privacy");
  return (
    <form action={action} className="flex flex-col gap-6">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}
      {documents.map((d) => (
        <section key={d.id} className="rounded-[14px] border border-line p-4 sm:p-5">
          <h2 className="text-lg">{d.title}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Version {d.version} · Effective {d.effective}
          </p>
          {d.summary && <p className="mt-3 whitespace-pre-line text-[15px]">{d.summary}</p>}
          <p className="mt-3 text-[15px]">
            <a href={`/legal/${d.kind}`} target="_blank" rel="noopener" className="font-semibold text-indigo hover:underline">
              Read the full {d.kind === "terms" ? "Terms and Conditions" : "Privacy Notice"}
            </a>
          </p>
        </section>
      ))}
      <div className="flex flex-col gap-3">
        {terms && (
          <>
            <input type="hidden" name="termsId" value={terms.id} />
            <Checkbox id="acceptTerms" name="acceptTerms" required label={`I accept the Terms and Conditions (version ${terms.version}).`} />
          </>
        )}
        {privacy && (
          <>
            <input type="hidden" name="privacyId" value={privacy.id} />
            <Checkbox
              id="acknowledgePrivacy"
              name="acknowledgePrivacy"
              required
              label={`I have read and acknowledge the Privacy Notice (version ${privacy.version}).`}
            />
          </>
        )}
      </div>
      <div>
        <Submit />
      </div>
    </form>
  );
}
