import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  provider: string;
};

export type Profile = {
  id: string;
  first_name: string | null;
  surname: string | null;
  onboarding_completed_at: string | null;
};

/**
 * The signed-in, verified user, or null. Validated with the Supabase Auth
 * server on every request (deduplicated within one render), so a revoked or
 * deleted session is not trusted.
 *
 * An account whose email is not confirmed is never treated as signed in.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const user = data.user;
  if (!user.email_confirmed_at) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    provider: (user.app_metadata?.provider as string | undefined) ?? "email",
  };
});

/** Use at the top of every protected page, layout and Server Action. */
export async function requireUser(nextPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }
  return user;
}

/** The signed-in user's own profile row (Row Level Security restricts it to them). */
export const getOwnProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, surname, onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();
  return data;
});

/** First-time users go to onboarding; returning users to their dashboard. */
export async function postAuthPath(userId: string): Promise<"/onboarding" | "/dashboard"> {
  const profile = await getOwnProfile(userId);
  return profile?.onboarding_completed_at ? "/dashboard" : "/onboarding";
}
