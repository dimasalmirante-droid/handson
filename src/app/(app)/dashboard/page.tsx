import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, Progress } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth/session";
import { getCompletion, getProfile } from "@/lib/data/student";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Returning users land here once onboarding is complete; others are sent to
 * onboarding. The full dashboard is built in Phase 5.
 */
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  const [profile, completion, sp] = await Promise.all([getProfile(user.id), getCompletion(user.id), searchParams]);
  if (!profile?.onboarding_completed_at) {
    redirect(typeof sp.notice === "string" ? `/onboarding?notice=${encodeURIComponent(sp.notice)}` : "/onboarding");
  }

  return (
    <AppShell email={user.email}>
      {sp.notice === "onboarding-complete" && (
        <Alert tone="success" className="mb-6" title="Your profile is set up">
          You can keep adding details at any time. Your profile stays private until you choose to share it.
        </Alert>
      )}
      {sp.notice === "password-updated" && (
        <Alert tone="success" className="mb-6">Your password has been updated.</Alert>
      )}
      <h1 className="text-[clamp(32px,5vw,44px)] tracking-[-0.03em]">
        Welcome back{profile.first_name ? `, ${profile.first_name}` : ""}
      </h1>
      <Card className="mt-8 max-w-2xl">
        <Progress value={completion?.total ?? 0} label="Profile completion" />
        <p className="mt-4 text-ink-muted">The full dashboard, with documents and privacy settings, is on its way.</p>
        <ButtonLink href="/onboarding/review" variant="secondary" className="mt-6">
          Review and edit my profile
        </ButtonLink>
      </Card>
    </AppShell>
  );
}
