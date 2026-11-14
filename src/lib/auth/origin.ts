import "server-only";
import { headers } from "next/headers";

/**
 * The origin the current request came in on (localhost, a Vercel preview or
 * app.handson.cloud), so auth redirects return the user to the same site.
 * Must be listed under Supabase → Authentication → URL Configuration → Redirect URLs.
 */
export async function requestOrigin(): Promise<string> {
  return originFromHeaders(await headers());
}

/** Pure form of requestOrigin: x-forwarded-host wins over host. */
export function originFromHeaders(h: { get(name: string): string | null }): string {
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
