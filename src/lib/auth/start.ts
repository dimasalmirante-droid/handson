import "server-only";
import { cookies } from "next/headers";
import { getContexts, getLegalStatus, getRememberedWorkspace } from "@/lib/auth/contexts";
import { decideDestination } from "@/lib/auth/destination";
import { safeNextPath } from "@/lib/auth/redirects";
import { getCurrentUser } from "@/lib/auth/session";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";

const NOTICES = ["verified", "password-updated"];

/**
 * Where a signed-in person should land, checked in order: signed in → not
 * suspended → current legal documents accepted → which workspace to open.
 * Also restores a student's saved language on a new device.
 *
 * Used by the /start route (links from emails and Google sign-in) and directly
 * by sign-in Server Actions, which must redirect to a page: a Server Action
 * redirect to a Route Handler leaves the browser on /start.
 */
export async function startDestination(opts: { next?: string | null; notice?: string | null } = {}): Promise<string> {
  const { next = null, notice = null } = opts;
  const withNotice = (path: string) =>
    notice && NOTICES.includes(notice) && !path.startsWith("/auth/") && !path.includes("?") ? `${path}?notice=${notice}` : path;

  const user = await getCurrentUser();
  if (!user) return "/login";

  const contexts = await getContexts();
  if (!contexts) return "/workspaces";
  if (contexts.account_status === "suspended") return "/auth/signout?reason=suspended";

  const legal = await getLegalStatus();
  if (legal.active && legal.required.length > 0) {
    const safe = next ? safeNextPath(next, "") : "";
    return safe ? `/legal/accept?next=${encodeURIComponent(safe)}` : "/legal/accept";
  }

  const store = await cookies();
  if (contexts.student && !store.get(LOCALE_COOKIE)) {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("preferred_locale").eq("id", user.id).maybeSingle();
    if (isLocale(data?.preferred_locale)) {
      store.set(LOCALE_COOKIE, data.preferred_locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
  }

  return withNotice(decideDestination(contexts, { next, remembered: await getRememberedWorkspace() }));
}
