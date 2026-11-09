import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/(auth)/actions";
import { AdminNav } from "@/components/admin/nav";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/feedback";
import { ROLE_LABELS, requireAdmin, roleAtLeast } from "@/lib/auth/admin";
import { getContexts } from "@/lib/auth/contexts";
import { listWorkspaces } from "@/lib/auth/destination";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Handson Admin" } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user, role } = await requireAdmin("reviewer");
  const contexts = await getContexts();
  const workspaces = contexts ? listWorkspaces(contexts) : [];
  const items = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/students", label: "Students" },
    ...(roleAtLeast(role, "super_admin")
      ? [
          { href: "/admin/team", label: "Team" },
          { href: "/admin/audit", label: "Audit log" },
          { href: "/admin/legal", label: "Legal documents" },
          { href: "/admin/maintenance", label: "Maintenance" },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-ink bg-ink text-white">
        <div className="mx-auto flex h-[64px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="font-display text-[24px] font-bold leading-none tracking-[-0.04em] text-white">
              handson<span className="text-lime">.</span>
            </Link>
            <Badge tone="lime">Admin</Badge>
          </div>
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <WorkspaceSwitcher workspaces={workspaces} current="admin" inverse />
            <span className="hidden text-sm text-[#D9D6E0] md:inline">
              {user.email} · {ROLE_LABELS[role]}
            </span>
            <form action={signOutAction}>
              <Button type="submit" size="sm" variant="accent">Sign out</Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
          <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <AdminNav items={items} />
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </main>
    </div>
  );
}
