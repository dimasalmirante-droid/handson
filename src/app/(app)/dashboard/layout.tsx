import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardNav } from "@/components/dashboard/nav";
import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";
import { getAdminRole } from "@/lib/auth/admin";
import { getProfile } from "@/lib/data/student";

/** Signed-in students who have finished onboarding. Others continue onboarding first. */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/dashboard");
  const profile = await getProfile(user.id);
  if (!profile?.onboarding_completed_at) {
    redirect((await getAdminRole(user.id)) ? "/admin" : "/onboarding");
  }

  return (
    <AppShell email={user.email}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <DashboardNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </AppShell>
  );
}
