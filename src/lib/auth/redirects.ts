/** Routes that require a signed-in, verified user. */
export const PROTECTED_PREFIXES = ["/onboarding", "/dashboard", "/admin", "/files", "/start", "/workspaces", "/employer", "/legal/accept"] as const;

/** Auth pages a signed-in user should be sent away from. */
export const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password", "/check-email"] as const;

export function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isGuestOnlyPath(pathname: string) {
  return (GUEST_ONLY_PATHS as readonly string[]).includes(pathname);
}

/**
 * Accept only same-site relative paths for post-login redirects, to prevent
 * open redirects (e.g. `?next=https://evil.example` or `?next=//evil.example`).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n\t]/.test(next)) return fallback;
  if (next.startsWith("/auth/")) return fallback;
  return next;
}
