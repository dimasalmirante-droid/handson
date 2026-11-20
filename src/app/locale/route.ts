import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { safeNextPath } from "@/lib/auth/redirects";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Switch language: /locale?set=en&next=/login
 * Remembers the choice in a cookie and, for signed-in students, in their profile.
 */
export async function GET(request: NextRequest) {
  const set = request.nextUrl.searchParams.get("set");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"), "/");
  const res = NextResponse.redirect(new URL(next, request.url), 303);
  if (!isLocale(set)) return res;

  res.cookies.set(LOCALE_COOKIE, set, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false });

  const user = await getCurrentUser();
  if (user) {
    const supabase = await createClient();
    // No-op for accounts without a student profile (Row Level Security limits it to the user's own row).
    await supabase.from("profiles").update({ preferred_locale: set }).eq("id", user.id);
  }
  return res;
}
