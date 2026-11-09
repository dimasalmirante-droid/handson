"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

/** Shared error screen for route error boundaries. Never shows technical details to users. */
export function ErrorState({ error, retry, home = "/" }: { error: unknown; retry: () => void; home?: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: string }).digest ?? "") : "";
  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col items-center rounded-[var(--radius-lg)] border border-line bg-surface-raised px-6 py-12 text-center">
      <p className="font-display text-2xl font-bold">Something went wrong</p>
      <p className="mt-2 text-ink-muted">
        We could not load this page. Your saved information is safe. Please try again in a moment.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <ButtonLink href={home} variant="secondary">Go back</ButtonLink>
      </div>
      {digest && <p className="mt-6 text-xs text-ink-muted">Reference: {digest}</p>}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[40vh] items-center justify-center gap-3 text-ink-muted">
      <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-indigo border-r-transparent" />
      {label}…
    </div>
  );
}
