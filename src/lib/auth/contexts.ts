import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Contexts } from "@/lib/auth/destination";
import { createClient } from "@/lib/supabase/server";

/** Remembered workspace choice. Only a preference: it is re-checked against my_contexts() on every use. */
export const WORKSPACE_COOKIE = "hs_workspace";

/** The signed-in person's workspaces, from the database (my_contexts). Null when signed out or on error. */
export const getContexts = cache(async (): Promise<Contexts | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_contexts");
  if (error) {
    if (error.code !== "42501") console.error("my_contexts failed", error.code, error.message);
    return null;
  }
  return data as Contexts;
});

export async function getRememberedWorkspace(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(WORKSPACE_COOKIE)?.value ?? null;
  return value && /^(student|admin|company:[0-9a-f-]{36})$/.test(value) ? value : null;
}

export type LegalStatus = {
  active: boolean;
  required: { id: string; kind: "terms" | "privacy"; version: string; title: string; summary: string | null; effective_at: string }[];
};

/** Which current legal documents the signed-in person still has to accept. */
export const getLegalStatus = cache(async (): Promise<LegalStatus> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("legal_acceptance_status");
  if (error) {
    console.error("legal_acceptance_status failed", error.code, error.message);
    return { active: false, required: [] };
  }
  return data as LegalStatus;
});
