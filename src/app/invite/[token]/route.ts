import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { hashInvitationToken, isWellFormedToken, INVITATION_TTL_DAYS } from "@/lib/invitations/token";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.pathname.split("/").filter(Boolean).at(-1) ?? "";
  if (!isWellFormedToken(token)) {
    return NextResponse.redirect(new URL("/invite?error=invalid", request.url));
  }

  // Keep only the hash in the browser cookie. The raw token is not used again
  // after this route has hashed it.
  const store = await cookies();
  store.set("hs_company_invitation", hashInvitationToken(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/invite",
    maxAge: INVITATION_TTL_DAYS * 24 * 60 * 60,
  });

  const response = NextResponse.redirect(new URL("/invite", request.url));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
