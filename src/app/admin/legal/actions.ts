"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { isLegalKind } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";

export type LegalResult = { ok: boolean; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function failure(error: { code?: string; message: string }, fallback: string): LegalResult {
  if (error.code === "42501") return { ok: false, message: "You do not have permission to do this." };
  if (error.code === "22023" || error.code === "P0002") return { ok: false, message: error.message };
  if (error.code === "23514") return { ok: false, message: "Check the version number, title and text." };
  console.error("legal admin action failed", error.code, error.message);
  return { ok: false, message: fallback };
}

/** Save a new draft or update an existing draft (super admins). Published versions cannot be edited. */
export async function saveLegalDraft(_prev: LegalResult | null, formData: FormData): Promise<LegalResult> {
  await requireAdmin("super_admin");
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const version = String(formData.get("version") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const effective = String(formData.get("effective") ?? "");
  if (id && !UUID.test(id)) return { ok: false, message: "Invalid request." };
  if (!isLegalKind(kind)) return { ok: false, message: "Choose the document." };
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/.test(version)) return { ok: false, message: "Use letters, numbers, dots or hyphens for the version, for example 1.0." };
  if (title.length < 3) return { ok: false, message: "Enter a title." };
  if (!body.trim()) return { ok: false, message: "Paste the full text." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effective)) return { ok: false, message: "Choose the effective date." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_legal_draft", {
    p_id: id || null,
    p_kind: kind,
    p_version: version,
    p_title: title,
    p_summary: summary,
    p_body: body,
    // Midnight in Maputo on the chosen day.
    p_effective_at: `${effective}T00:00:00+02:00`,
  });
  if (error) return failure(error, "The draft could not be saved.");
  revalidatePath("/admin/legal");
  return { ok: true, message: "Draft saved. It is not visible to anyone else until you publish it." };
}

/** Publish a draft (super admins). Irreversible. */
export async function publishLegalDocument(id: string): Promise<LegalResult> {
  await requireAdmin("super_admin");
  if (!UUID.test(id)) return { ok: false, message: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_publish_legal_document", { p_id: id });
  if (error) return failure(error, "The document could not be published.");
  revalidatePath("/admin/legal");
  return { ok: true, message: "Published. It becomes current on its effective date." };
}

export async function deleteLegalDraft(id: string): Promise<LegalResult> {
  await requireAdmin("super_admin");
  if (!UUID.test(id)) return { ok: false, message: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_legal_draft", { p_id: id });
  if (error) return failure(error, "The draft could not be deleted.");
  revalidatePath("/admin/legal");
  return { ok: true, message: "Draft deleted." };
}
