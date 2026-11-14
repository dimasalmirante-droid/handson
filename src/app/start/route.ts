import { NextResponse, type NextRequest } from "next/server";
import { getContexts, getLegalStatus, getRememberedWorkspace } from "@/lib/auth/contexts";
import { decideDestination } from "@/lib/auth/destination";
import { safeNextPath } from "@/lib/auth/redirects";
import { getCurrentUser } from "@/lib/auth/session";

const NOTICES = ["verified", "password-updated"];

/**
 * Single entry point after sign-in, password reset, email confirmation and
 * Google sign-in, and when a signed-in person opens the site root.
 * Checks, in order: signed in → not suspended → current legal documents
 * accepted → which workspace to open.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const next = searchParams.get("next");
  const go = (path: string) => NextResponse.redirect(new URL(path, origin));
  // One-off confirmation messages shown on the destination page.
  const notice = searchParams.get("notice");
  const withNotice = (path: string) =>
    notice && NOTICES.includes(notice) && !path.startsWith("/auth/") && !path.includes("?")
      ? `${path}?notice=${notice}`
      : path;

  const user = await getCurrentUser();
  if (!user) return go("/login");

  const contexts = await getContexts();
  if (!contexts) return go("/workspaces");
  if (contexts.account_status === "suspended") return go("/auth/signout?reason=suspended");

  const legal = await getLegalStatus();
  if (legal.active && legal.required.length > 0) {
    const safe = next ? safeNextPath(next, "") : "";
    return go(safe ? `/legal/accept?next=${encodeURIComponent(safe)}` : "/legal/accept");
  }

  return go(withNotice(decideDestination(contexts, { next, remembered: await getRememberedWorkspace() })));
}
