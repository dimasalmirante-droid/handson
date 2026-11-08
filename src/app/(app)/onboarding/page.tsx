import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Alert, Card, Stepper } from "@/components/ui/feedback";
import { getOwnProfile, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Build your profile" };

const STEPS = ["Personal", "Education", "Skills", "Interests", "Experience", "Documents"];

/**
 * Phase 2: confirms routing for first-time users. The six-step wizard itself
 * is built in Phase 4.
 */
export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser("/onboarding");
  const profile = await getOwnProfile(user.id);
  if (profile?.onboarding_completed_at) redirect("/dashboard");

  const sp = await searchParams;
  const verified = sp.notice === "verified";
  const passwordUpdated = sp.notice === "password-updated";

  return (
    <AppShell email={user.email}>
      <div className="max-w-3xl">
        {verified && (
          <Alert tone="success" className="mb-6" title="Email verified">
            Your account is active.
          </Alert>
        )}
        {passwordUpdated && (
          <Alert tone="success" className="mb-6">
            Your password has been updated.
          </Alert>
        )}
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-indigo">Your profile</p>
        <h1 className="mt-2 text-[clamp(32px,5vw,44px)] tracking-[-0.03em]">
          Welcome{profile?.first_name ? `, ${profile.first_name}` : ""}
        </h1>
        <p className="mt-3 text-lg text-ink-muted">
          Your account is set up. Next, you will build your professional profile in six short steps.
        </p>

        <Card className="mt-8">
          <Stepper steps={STEPS.map((label) => ({ label, status: "upcoming" as const }))} />
          <Alert tone="info" className="mt-6" title="The profile builder is on its way">
            We are finishing the step-by-step profile builder. Your account is saved, and you will be able to continue
            from here when it opens.
          </Alert>
        </Card>
      </div>
    </AppShell>
  );
}
