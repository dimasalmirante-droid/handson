import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Ends the session (used when an account is suspended) and returns to the login page. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const reason = request.nextUrl.searchParams.get("reason") === "suspended" ? "?error=suspended" : "?notice=signed-out";
  return NextResponse.redirect(new URL(`/login${reason}`, request.url));
}
