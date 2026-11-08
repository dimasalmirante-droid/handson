import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirects";
import { postAuthPath } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "email_change", "invite"];

/**
 * Target of the links in verification and password-reset emails.
 *
 * Preferred: `token_hash` links (custom email templates), which work even
 * when opened on a different device or browser from the one used to sign up.
 * Fallback: `code` links (Supabase default templates), which work only in the
 * browser that requested the email.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  const supabase = await createClient();
  let userId: string | null = null;
  let isRecovery = false;

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error || !data.user) {
      console.error("verifyOtp failed", error?.code, error?.message);
      return NextResponse.redirect(new URL("/login?error=link", origin));
    }
    userId = data.user.id;
    isRecovery = type === "recovery";
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      console.error("exchangeCodeForSession (email link) failed", error?.code, error?.message);
      return NextResponse.redirect(new URL("/login?error=link", origin));
    }
    userId = data.user.id;
    isRecovery = next === "/reset-password";
  } else {
    return NextResponse.redirect(new URL("/login?error=link", origin));
  }

  if (isRecovery) {
    return NextResponse.redirect(new URL("/reset-password", origin));
  }

  const home = await postAuthPath(userId);
  const target = new URL(next ? safeNextPath(next, home) : home, origin);
  target.searchParams.set("notice", "verified");
  return NextResponse.redirect(target);
}
