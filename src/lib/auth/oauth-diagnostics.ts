/**
 * TEMPORARY observability for the Google sign-in host investigation (remove
 * once resolved). Produces only hosts, the deployment identity and a boolean
 * about the PKCE cookie. It never returns cookie values, the OAuth code,
 * state, tokens or query strings.
 */

type HeaderReader = { get(name: string): string | null };

/** Host (no scheme, path or query) of a URL or origin; null if unparsable. */
export function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

export function describeRequest(h: HeaderReader, opts: { cookieNames?: string[] } = {}) {
  const env = process.env;
  return {
    host: h.get("host"),
    forwardedHost: h.get("x-forwarded-host"),
    forwardedProto: h.get("x-forwarded-proto"),
    originHost: hostOf(h.get("origin")),
    refererHost: hostOf(h.get("referer")),
    deployment: {
      vercelEnv: env.VERCEL_ENV ?? null,
      gitRef: env.VERCEL_GIT_COMMIT_REF ?? null,
      deploymentId: env.VERCEL_DEPLOYMENT_ID ?? null,
      vercelUrl: env.VERCEL_URL ?? null,
    },
    // Names only, never values: is a PKCE verifier cookie present on this host?
    ...(opts.cookieNames
      ? { hasPkceVerifierCookie: opts.cookieNames.some((n) => n.includes("code-verifier")) }
      : {}),
  };
}
