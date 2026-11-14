"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/redirects";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type AcceptState = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Record acceptance of the Terms and/or acknowledgement of the Privacy
 * Notice. Each required document needs its own ticked checkbox; the database
 * accepts only the exact current versions.
 */
export async function acceptLegalAction(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  await requireUser("/legal/accept", { skipLegal: true });
  const termsId = String(formData.get("termsId") ?? "");
  const privacyId = String(formData.get("privacyId") ?? "");
  if (termsId && formData.get("acceptTerms") !== "on") return { error: "Tick the box to accept the Terms and Conditions." };
  if (privacyId && formData.get("acknowledgePrivacy") !== "on") return { error: "Tick the box to confirm you have read the Privacy Notice." };
  if ((termsId && !UUID.test(termsId)) || (privacyId && !UUID.test(privacyId)) || (!termsId && !privacyId)) {
    return { error: "Please reload the page and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_legal_documents", {
    p_terms_id: termsId || null,
    p_privacy_id: privacyId || null,
  });
  if (error) {
    if (error.code === "22023") return { error: error.message };
    console.error("accept_legal_documents failed", error.code, error.message);
    return { error: "Your acceptance could not be saved. Please try again." };
  }
  const next = safeNextPath(String(formData.get("next") ?? ""), "");
  redirect(next && !next.startsWith("/legal/accept") ? next : "/start");
}
