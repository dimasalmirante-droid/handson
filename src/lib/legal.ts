/** Shared, pure helpers for the Terms and Privacy Notice (safe for client and tests). */

export type LegalKind = "terms" | "privacy";

export const LEGAL_KINDS: LegalKind[] = ["terms", "privacy"];
export const LEGAL_LABELS: Record<LegalKind, string> = { terms: "Terms and Conditions", privacy: "Privacy Notice" };
export const isLegalKind = (v: string): v is LegalKind => v === "terms" || v === "privacy";

/**
 * Split stored plain text into blocks for display. Lines starting with "# "
 * or "## " become headings; blank lines separate paragraphs. The text is
 * always rendered as text, never as HTML.
 */
export function legalBlocks(body: string): { type: "h2" | "h3" | "p"; text: string }[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      if (chunk.startsWith("## ")) return { type: "h3" as const, text: chunk.slice(3).trim() };
      if (chunk.startsWith("# ")) return { type: "h2" as const, text: chunk.slice(2).trim() };
      return { type: "p" as const, text: chunk };
    });
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Maputo" });
