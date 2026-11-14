/**
 * Public environment variables. Read through this module so a missing value
 * fails loudly with a clear message instead of an obscure Supabase error.
 * Server-only secrets must never be added here.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local (local) or set it in Vercel (deployed).`,
    );
  }
  return value;
}

export const publicEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabasePublishableKey() {
    return required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  },
};

/**
 * The production Supabase project. Preview and staging deployments must never
 * use it: the proxy refuses to serve a preview deployment configured with it.
 */
export const PRODUCTION_SUPABASE_REF = "mcqrcwlvvdbhpmfretdu";

/** True when a Vercel preview deployment is (mis)configured with the production database. */
export function previewUsesProductionDatabase(env: Record<string, string | undefined> = process.env): boolean {
  if (env.VERCEL_ENV !== "preview") return false;
  return (env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes(PRODUCTION_SUPABASE_REF);
}
