import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/data/student";
import { stepPath } from "@/lib/onboarding/steps";

/** Resume where the student left off. */
export default async function OnboardingIndex({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser("/onboarding");
  const profile = await getProfile(user.id);
  const sp = await searchParams;
  const target = stepPath(profile?.onboarding_step ?? 1);
  redirect(typeof sp.notice === "string" ? `${target}?notice=${encodeURIComponent(sp.notice)}` : target);
}
