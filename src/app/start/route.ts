import { NextResponse, type NextRequest } from "next/server";
import { startDestination } from "@/lib/auth/start";

/**
 * Single entry point after email confirmation and Google sign-in, and when a
 * signed-in person opens the site root. The decision lives in startDestination().
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const path = await startDestination({ next: searchParams.get("next"), notice: searchParams.get("notice") });
  return NextResponse.redirect(new URL(path, origin));
}
