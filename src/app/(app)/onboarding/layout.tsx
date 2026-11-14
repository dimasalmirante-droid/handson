import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { WizardStepper } from "@/components/onboarding/wizard";
import { Progress } from "@/components/ui/feedback";
import { getContexts } from "@/lib/auth/contexts";
import { listWorkspaces } from "@/lib/auth/destination";
import { requireStudent } from "@/lib/auth/session";
import { getCompletion } from "@/lib/data/student";

const SECTION_STEP: Record<string, number> = {
  personal: 1, education: 2, skills: 3, interests: 4, experience: 5, documents: 6,
};

/** Shared frame for every onboarding step: header, completion and step navigation. */
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const user = await requireStudent("/onboarding");
  const [completion, contexts] = await Promise.all([getCompletion(user.id), getContexts()]);

  const completeSteps = completion
    ? Object.entries(completion.sections)
        .filter(([, s]) => s.score >= s.weight)
        .map(([k]) => SECTION_STEP[k])
    : [];

  return (
    <AppShell email={user.email} workspaces={contexts ? listWorkspaces(contexts) : []} current="student">
      <div className="mx-auto min-w-0 max-w-4xl">
        <div className="mb-8 flex flex-col gap-6">
          <Progress value={completion?.total ?? 0} label="Profile completion" />
          <WizardStepper completeSteps={completeSteps} />
        </div>
        <div className="rounded-[var(--radius-lg)] border border-line bg-surface-raised p-5 sm:p-10">{children}</div>
      </div>
    </AppShell>
  );
}
