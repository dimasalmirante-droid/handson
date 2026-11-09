import { switchWorkspace } from "@/app/workspaces/actions";
import type { Workspace } from "@/lib/auth/destination";
import { cn } from "@/lib/cn";

/**
 * Lets people with more than one workspace (student profile, Handson admin,
 * companies) move between them. Hidden for everyone else. The server checks
 * the choice against the person's own workspaces.
 */
export function WorkspaceSwitcher({ workspaces, current, inverse }: { workspaces: Workspace[]; current?: string | null; inverse?: boolean }) {
  if (workspaces.length < 2) return null;
  const active = workspaces.find((w) => w.key === current);
  return (
    <details className="group relative">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 rounded-[var(--radius-pill)] border px-3 py-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden",
          inverse ? "border-white/30 text-white hover:bg-white/10" : "border-line text-ink hover:bg-indigo-soft",
        )}
      >
        <span className="max-w-[160px] truncate">{active?.label ?? "Workspaces"}</span>
        <span aria-hidden className="text-xs">▾</span>
        <span className="sr-only">Switch workspace</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-[14px] border border-line bg-surface-raised p-2 text-ink shadow-lg">
        <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Switch workspace</p>
        <ul>
          {workspaces.map((w) => (
            <li key={w.key}>
              <form action={switchWorkspace}>
                <input type="hidden" name="workspace" value={w.key} />
                <button
                  type="submit"
                  aria-current={w.key === current ? "true" : undefined}
                  className={cn(
                    "flex w-full flex-col items-start rounded-[10px] px-3 py-2 text-left hover:bg-indigo-soft",
                    w.key === current && "bg-surface",
                  )}
                >
                  <span className="text-[15px] font-semibold">{w.label}</span>
                  <span className="text-sm text-ink-muted">{w.detail}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
        <a href="/workspaces" className="mt-1 block rounded-[10px] px-3 py-2 text-sm font-semibold text-indigo hover:bg-indigo-soft">
          All workspaces
        </a>
      </div>
    </details>
  );
}
