import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Signs out a suspended account. Only acts when the signed-in account really
 * is suspended, so other sites cannot use this link to sign people out.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: profile } = await supabase.from("profiles").select("account_status").eq("id", data.user.id).maybeSingle();
  if (profile?.account_status !== "suspended") return NextResponse.redirect(new URL("/dashboard", request.url));

  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login?error=suspended", request.url));
}
