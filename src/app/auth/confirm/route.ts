import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirects";
import { postAuthPath } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "email_change", "invite"];

/**
 * Target of the links in verification and password-reset emails.
 * Uses `token_hash`, so the link works even when opened on a different
 * device or browser from the one used to sign up.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.redirect(new URL("/login?error=link", origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=link", origin));
  }

  if (type === "recovery") {
    return NextResponse.redirect(new URL("/reset-password", origin));
  }

  const home = await postAuthPath(data.user.id);
  const next = searchParams.get("next");
  const target = new URL(next ? safeNextPath(next, home) : home, origin);
  target.searchParams.set("notice", "verified");
  return NextResponse.redirect(target);
}
