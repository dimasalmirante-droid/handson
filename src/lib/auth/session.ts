import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getContexts, getLegalStatus } from "@/lib/auth/contexts";
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
  account_status: "active" | "suspended";
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

/**
 * Use at the top of every protected page, layout and Server Action.
 * 1. Signed-out visitors go to login.
 * 2. Suspended accounts (with or without a student profile) are signed out.
 * 3. Accounts that have not accepted the current Terms and Privacy Notice go
 *    to the acceptance screen (only once final documents are in force).
 */
export async function requireUser(nextPath?: string, opts: { skipLegal?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }
  const contexts = await getContexts();
  if (contexts?.account_status === "suspended") redirect("/auth/signout?reason=suspended");
  if (!opts.skipLegal) {
    const legal = await getLegalStatus();
    if (legal.active && legal.required.length > 0) {
      redirect(nextPath ? `/legal/accept?next=${encodeURIComponent(nextPath)}` : "/legal/accept");
    }
  }
  return user;
}

/**
 * Student areas (onboarding, dashboard, uploads). People without a student
 * profile — for example employer-only users — go to their workspace list,
 * where they can create one.
 */
export async function requireStudent(nextPath?: string): Promise<CurrentUser> {
  const user = await requireUser(nextPath);
  const contexts = await getContexts();
  if (!contexts?.student) redirect("/workspaces");
  return user;
}

/** The signed-in user's own profile row (Row Level Security restricts it to them). */
export const getOwnProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, surname, onboarding_completed_at, account_status")
    .eq("id", userId)
    .maybeSingle();
  return data;
});
