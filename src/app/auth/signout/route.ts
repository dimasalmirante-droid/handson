import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign-out link used when an account is suspended.
 * - Suspended account (with or without a student profile): signs out and
 *   shows the suspension message on the login page.
 * - Any other signed-in account: shows a public confirmation page with a
 *   sign-out button, so a link on another site cannot sign people out.
 * - Signed out: the login page.
 * It never redirects to a protected page.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: account } = await supabase.from("accounts").select("status").eq("user_id", data.user.id).maybeSingle();
  if (account?.status !== "suspended") return NextResponse.redirect(new URL("/signout", request.url));

  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login?error=suspended", request.url));
}
