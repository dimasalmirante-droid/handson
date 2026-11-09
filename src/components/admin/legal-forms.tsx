"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteLegalDraft, publishLegalDocument, saveLegalDraft, type LegalResult } from "@/app/admin/legal/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

export type DraftValues = {
  id?: string;
  kind: "terms" | "privacy";
  version: string;
  title: string;
  summary: string;
  body: string;
  effective: string;
};

/** Create or edit a draft of the Terms or the Privacy Notice. */
export function LegalDraftForm({ initial, onDone }: { initial?: DraftValues; onDone?: () => void }) {
  const [state, action, pending] = useActionState<LegalResult | null, FormData>(async (prev, fd) => {
    const r = await saveLegalDraft(prev, fd);
    if (r.ok) onDone?.();
    return r;
  }, null);
  const v = initial;
  const p = v?.id ?? "new";
  return (
    <form action={action} className="flex flex-col gap-4">
      {state && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
      {v?.id && <input type="hidden" name="id" value={v.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`kind-${p}`} label="Document" required>
          <Select id={`kind-${p}`} name="kind" defaultValue={v?.kind ?? "terms"}>
            <option value="terms">Terms and Conditions</option>
            <option value="privacy">Privacy Notice</option>
          </Select>
        </Field>
        <Field id={`version-${p}`} label="Version" required hint="For example 1.0">
          <Input id={`version-${p}`} name="version" required maxLength={50} defaultValue={v?.version} />
        </Field>
        <Field id={`effective-${p}`} label="Effective date" required hint="Becomes current on this day">
          <Input id={`effective-${p}`} name="effective" type="date" required defaultValue={v?.effective} />
        </Field>
      </div>
      <Field id={`title-${p}`} label="Title" required>
        <Input id={`title-${p}`} name="title" required maxLength={200} defaultValue={v?.title} />
      </Field>
      <Field id={`summary-${p}`} label="What changed (shown on the acceptance screen)">
        <Textarea id={`summary-${p}`} name="summary" className="min-h-20" maxLength={2000} defaultValue={v?.summary} />
      </Field>
      <Field id={`body-${p}`} label="Full text" required hint='Plain text. Start a line with "# " or "## " for headings; leave a blank line between paragraphs.'>
        <Textarea id={`body-${p}`} name="body" className="min-h-72 font-mono text-sm" required defaultValue={v?.body} />
      </Field>
      <div>
        <Button type="submit" loading={pending}>Save draft</Button>
      </div>
    </form>
  );
}

export function DraftControls({ draft, label }: { draft: DraftValues & { id: string }; label: string }) {
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<LegalResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setEditing((e) => !e)}>{editing ? "Close" : "Edit draft"}</Button>
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Publish ${label}? Published versions cannot be changed or withdrawn. Once in force, every user will be asked to accept it.`)) return;
            start(async () => setResult(await publishLegalDocument(draft.id)));
          }}
        >
          Publish
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Delete the draft ${label}?`)) return;
            start(async () => setResult(await deleteLegalDraft(draft.id)));
          }}
        >
          Delete draft
        </Button>
      </div>
      {result && <Alert tone={result.ok ? "success" : "danger"}>{result.message}</Alert>}
      {editing && (
        <div className="rounded-[12px] bg-surface p-4">
          <LegalDraftForm initial={draft} onDone={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}
