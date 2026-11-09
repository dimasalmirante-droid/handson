import type { Metadata } from "next";
import { InterestsStep } from "@/components/onboarding/interests-step";
import { StepHeader } from "@/components/onboarding/wizard";
import { requireUser } from "@/lib/auth/session";
import { getCatalogues } from "@/lib/data/catalogues";
import { getInterests } from "@/lib/data/student";

export const metadata: Metadata = { title: "Professional interests" };

export default async function InterestsPage() {
  const user = await requireUser("/onboarding/interests");
  const [interests, catalogues] = await Promise.all([getInterests(user.id), getCatalogues()]);

  return (
    <>
      <StepHeader
        step={4}
        title="Professional interests"
        lead="Tell us what you are looking for, so future opportunities can match your goals. Your choices save automatically."
      />
      <InterestsStep
        initial={interests}
        industries={catalogues.industries}
        jobFunctions={catalogues.jobFunctions}
        provinces={catalogues.provinces}
      />
    </>
  );
}
