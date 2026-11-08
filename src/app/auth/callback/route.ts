import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirects";
import { postAuthPath } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth (Google) return URL. Exchanges the one-time code for a session,
 * then sends first-time users to onboarding and returning users to their
 * dashboard (or to a safe `next` path).
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

  const home = await postAuthPath(data.user.id);
  const next = searchParams.get("next");
  return NextResponse.redirect(new URL(next ? safeNextPath(next, home) : home, origin));
}
