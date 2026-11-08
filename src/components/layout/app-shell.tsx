import type { ReactNode } from "react";
import { signOutAction } from "@/app/(auth)/actions";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";

/** Header for signed-in pages: wordmark, account email and sign-out. */
export function AppShell({ email, children }: { email: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Wordmark href="/dashboard" />
          <div className="flex items-center gap-4">
            <span className="hidden max-w-[240px] truncate text-sm text-ink-muted sm:inline" title={email}>
              {email}
            </span>
            <form action={signOutAction}>
              <Button type="submit" variant="secondary" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">{children}</main>
    </div>
  );
}
