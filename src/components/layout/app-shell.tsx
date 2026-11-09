import type { ReactNode } from "react";
import { signOutAction } from "@/app/(auth)/actions";
import { Wordmark } from "@/components/brand/wordmark";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/lib/auth/destination";

/** Header for signed-in pages: wordmark, workspace switcher (when there is more than one), account email and sign-out. */
export function AppShell({
  email,
  children,
  home = "/dashboard",
  workspaces = [],
  current,
}: {
  email: string;
  children: ReactNode;
  home?: string;
  workspaces?: Workspace[];
  current?: string | null;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Wordmark href={home} />
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <WorkspaceSwitcher workspaces={workspaces} current={current} />
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
