import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { getOwnProfile, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Phase 2: returning users land here once onboarding is complete; others are
 * sent to onboarding. The full dashboard is built in Phase 5.
 */
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  const profile = await getOwnProfile(user.id);
  if (!profile?.onboarding_completed_at) {
    const sp = await searchParams;
    redirect(typeof sp.notice === "string" ? `/onboarding?notice=${encodeURIComponent(sp.notice)}` : "/onboarding");
  }

  const sp = await searchParams;

  return (
    <AppShell email={user.email}>
      {sp.notice === "password-updated" && (
        <Alert tone="success" className="mb-6">
          Your password has been updated.
        </Alert>
      )}
      <h1 className="text-[clamp(32px,5vw,44px)] tracking-[-0.03em]">
        Welcome back{profile.first_name ? `, ${profile.first_name}` : ""}
      </h1>
      <div className="mt-8">
        <EmptyState title="Your dashboard is on its way">
          Profile completion, documents and settings will appear here.
        </EmptyState>
      </div>
    </AppShell>
  );
}
