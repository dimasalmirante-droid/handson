import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirects";
import { ensureStudentProfile } from "@/lib/auth/student-profile";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth (Google) return URL. Exchanges the one-time code for a session, then
 * continues to a safe `next` path or to /start, which picks the workspace.
 *
 * `intent=student` is added only by the student registration page. If the
 * account has no workspace at all yet (for example, the sign-up trigger did
 * not create a student profile because an employer invitation is pending),
 * a student profile is created for the person themselves. This never grants
 * anything else, and never adds a profile to someone who already has a
 * workspace. Invitation acceptance does not happen here: it needs the token
 * and is done only on the invitation page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");

  if (providerError || !code) {
    return NextResponse.redirect(new URL("/login?error=google", origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("exchangeCodeForSession failed", error?.code, error?.message);
    return NextResponse.redirect(new URL("/login?error=google", origin));
  }

  if (searchParams.get("intent") === "student") {
    await ensureStudentProfile(supabase);
  }

  const next = searchParams.get("next");
  return NextResponse.redirect(new URL(next ? safeNextPath(next, "/start") : "/start", origin));
}
