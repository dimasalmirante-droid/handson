import { safeNextPath } from "@/lib/auth/redirects";

/**
 * The address Google returns to after sign-in. `next` must be a safe
 * same-site path; `intent=student` is added only by the student registration
 * page. The invitation token is never part of this address.
 */
export function googleCallbackUrl(origin: string, opts: { next?: string | null; intent?: string | null } = {}): string {
  const url = new URL("/auth/callback", origin);
  const next = safeNextPath(opts.next ?? "", "");
  if (next) url.searchParams.set("next", next);
  if (opts.intent === "student") url.searchParams.set("intent", "student");
  return url.toString();
}
