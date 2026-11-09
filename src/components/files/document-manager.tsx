"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteDocument } from "@/app/(app)/files/actions";
import { uploadStatusText, useUpload } from "@/components/files/use-upload";
import { Button, buttonClasses } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import type { DocumentRecord } from "@/lib/data/student";
import { DOCUMENT_TYPE_LABELS, SINGLE_FILE_TYPES, acceptAttribute, formatBytes, formatsLabel, type DocumentType } from "@/lib/files";

const SLOTS: { type: DocumentType; required: boolean; note: string }[] = [
  { type: "cv", required: true, note: "Counts for 10% of your profile" },
  { type: "transcript", required: true, note: "Counts for 10% of your profile" },
  { type: "certificate", required: false, note: "Optional. Add as many as you need" },
  { type: "cover_letter", required: false, note: "Optional" },
  { type: "other", required: false, note: "Optional. Any other supporting document" },
];

const VERIFICATION: Record<string, { tone: "neutral" | "indigo" | "success" | "danger"; label: string }> = {
  unverified: { tone: "neutral", label: "Not yet verified" },
  pending: { tone: "indigo", label: "Under review" },
  verified: { tone: "success", label: "Verified" },
  rejected: { tone: "danger", label: "Rejected" },
};

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** All document types, each with its files and upload / replace / open / remove actions. */
export function DocumentManager({ documents }: { documents: DocumentRecord[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        Accepted: {formatsLabel("document")}, up to 10 MB each. Files are stored privately; only you and authorised Handson staff can open them.
      </p>
      <ul className="flex flex-col gap-3">
        {SLOTS.map((slot) => (
          <DocumentSlot key={slot.type} {...slot} files={documents.filter((d) => d.document_type === slot.type)} />
        ))}
      </ul>
    </div>
  );
}

function DocumentSlot({ type, required, note, files }: { type: DocumentType; required: boolean; note: string; files: DocumentRecord[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const { state, upload, reset } = useUpload("document", type);
  const [removing, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);
  const single = SINGLE_FILE_TYPES.includes(type);
  const busy = state.phase === "checking" || state.phase === "uploading" || state.phase === "verifying";
  const status = uploadStatusText(state);
  const label = DOCUMENT_TYPE_LABELS[type];
  const inputId = `upload-${type}`;

  return (
    <li className="rounded-[16px] border border-line p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">
            {label}
            {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
            {required && <span className="sr-only"> (required)</span>}
          </p>
          <p className="text-sm text-ink-muted">{note}</p>
        </div>
        <div>
          <input
            ref={input}
            id={inputId}
            type="file"
            tabIndex={-1}
            className="sr-only"
            accept={acceptAttribute("document")}
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) await upload(file);
            }}
          />
          <label
            htmlFor={inputId}
            className={cn(
              buttonClasses({ variant: files.length && single ? "secondary" : "primary", size: "sm" }),
              "cursor-pointer has-[:disabled]:opacity-50",
              busy && "pointer-events-none opacity-60",
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                input.current?.click();
              }
            }}
            tabIndex={0}
            role="button"
            aria-disabled={busy || undefined}
            aria-label={`${files.length && single ? "Replace" : files.length ? "Add another" : "Upload"} ${label}`}
          >
            {busy ? "Uploading…" : files.length && single ? "Replace" : files.length ? "Add another" : "Upload"}
          </label>
        </div>
      </div>

      <div aria-live="polite">
        {status && state.phase !== "done" && (
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
            <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-indigo border-r-transparent" />
            {status}
          </p>
        )}
        {state.phase === "done" && (
          <Alert tone="success" className="mt-3">{status}</Alert>
        )}
        {state.phase === "error" && (
          <Alert tone="danger" className="mt-3">
            {state.message}{" "}
            <button type="button" className="font-semibold underline" onClick={reset}>Dismiss</button>
          </Alert>
        )}
        {removeError && <Alert tone="danger" className="mt-3">{removeError}</Alert>}
      </div>

      {files.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-[12px] bg-surface">
          {files.map((f) => {
            const v = VERIFICATION[f.verification_status] ?? VERIFICATION.unverified;
            return (
              <li key={f.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium" title={f.original_filename}>{f.original_filename}</p>
                  <p className="text-sm text-ink-muted">
                    {formatBytes(f.size_bytes)} · uploaded {dateLabel(f.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={v.tone}>{v.label}</Badge>
                  <a href={`/files/${f.id}`} target="_blank" rel="noopener" className={buttonClasses({ variant: "ghost", size: "sm" })}>
                    Open
                  </a>
                  <a href={`/files/${f.id}?download=1`} className={buttonClasses({ variant: "ghost", size: "sm" })}>
                    Download
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={removing}
                    onClick={() => {
                      if (!window.confirm(`Remove ${f.original_filename}? This cannot be undone.`)) return;
                      startRemove(async () => {
                        setRemoveError(null);
                        const r = await deleteDocument(f.id);
                        if (!r.ok) setRemoveError(r.error);
                        router.refresh();
                      });
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
