import "server-only";
import { cache } from "react";
import type { LegalKind } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";

export type LegalSummary = {
  id: string;
  kind: LegalKind;
  version: string;
  title: string;
  summary: string | null;
  effective_at: string;
  published_at: string;
};

export type LegalDocument = LegalSummary & { body: string; status: "draft" | "published" };

/** The current, effective version of each document (none until final versions are published and in force). */
export const getCurrentLegalDocuments = cache(async (): Promise<{ terms: LegalSummary | null; privacy: LegalSummary | null }> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_legal_documents");
  if (error) {
    console.error("current_legal_documents failed", error.code, error.message);
    return { terms: null, privacy: null };
  }
  const rows = (data ?? []) as LegalSummary[];
  return {
    terms: rows.find((r) => r.kind === "terms") ?? null,
    privacy: rows.find((r) => r.kind === "privacy") ?? null,
  };
});

/** A published version with its full text (Row Level Security hides drafts from everyone but super admins). */
export async function getPublishedLegalDocument(kind: LegalKind, version: string): Promise<LegalDocument | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("legal_documents")
    .select("id, kind, version, title, summary, body, effective_at, published_at, status")
    .eq("kind", kind)
    .eq("version", version)
    .eq("status", "published")
    .maybeSingle();
  return (data as LegalDocument | null) ?? null;
}

/** Earlier published versions of a document, newest first. */
export async function getLegalHistory(kind: LegalKind): Promise<LegalSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("legal_documents")
    .select("id, kind, version, title, summary, effective_at, published_at")
    .eq("kind", kind)
    .eq("status", "published")
    .order("effective_at", { ascending: false });
  return (data ?? []) as LegalSummary[];
}

/** Every version including drafts (super admins only; others see published versions). */
export async function getAllLegalDocuments(): Promise<LegalDocument[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("legal_documents")
    .select("id, kind, version, title, summary, body, effective_at, published_at, status")
    .order("kind")
    .order("effective_at", { ascending: false });
  return (data ?? []) as LegalDocument[];
}

