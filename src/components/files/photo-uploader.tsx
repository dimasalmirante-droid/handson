"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { removePhoto } from "@/app/(app)/files/actions";
import { uploadStatusText, useUpload } from "@/components/files/use-upload";
import { Button, buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { acceptAttribute } from "@/lib/files";

/** Profile photo: preview, upload, replace and remove. */
export function PhotoUploader({ photoUrl, initials }: { photoUrl: string | null; initials: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const { state, upload } = useUpload("avatar");
  const [preview, setPreview] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const busy = state.phase === "checking" || state.phase === "uploading" || state.phase === "verifying";
  const shown = preview ?? photoUrl;

  return (
    <div className="flex items-center gap-5">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-lime">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
          <img src={shown} alt="Your profile photo" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center font-display text-2xl font-bold text-ink" aria-hidden>
            {initials}
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/40">
            <span aria-hidden className="size-6 animate-spin rounded-full border-2 border-white border-r-transparent" />
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold">Profile photo</p>
        <p className="text-sm text-ink-muted">Optional. A clear, professional photo. JPG, PNG or WebP, up to 2 MB.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            ref={input}
            id="photo-upload"
            type="file"
            tabIndex={-1}
            accept={acceptAttribute("avatar")}
            className="sr-only"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setError(null);
              const local = URL.createObjectURL(file);
              setPreview(local);
              const ok = await upload(file);
              if (!ok) setPreview(null);
            }}
          />
          <label
            htmlFor="photo-upload"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                input.current?.click();
              }
            }}
            className={cn(buttonClasses({ variant: "secondary", size: "sm" }), "cursor-pointer", busy && "pointer-events-none opacity-60")}
          >
            {shown ? "Change photo" : "Upload photo"}
          </label>
          {shown && !busy && (
            <Button
              size="sm"
              variant="ghost"
              disabled={removing}
              onClick={() =>
                startRemove(async () => {
                  const r = await removePhoto();
                  if (!r.ok) setError(r.error);
                  setPreview(null);
                  router.refresh();
                })
              }
            >
              Remove
            </Button>
          )}
        </div>
        <p aria-live="polite" className={cn("mt-1 text-sm", state.phase === "error" || error ? "font-medium text-danger" : "text-ink-muted")}>
          {state.phase === "error" ? state.message : error ?? (busy ? uploadStatusText(state) : "")}
        </p>
      </div>
    </div>
  );
}
