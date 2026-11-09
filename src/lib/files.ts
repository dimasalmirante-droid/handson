/**
 * File rules shared by the browser (instant feedback) and the server
 * (enforcement). The server re-checks everything after upload, including the
 * file's actual content, so the browser checks are a convenience only.
 */

export type FileKind = "document" | "avatar";

type FormatId = "pdf" | "docx" | "doc" | "jpeg" | "png" | "webp";

const FORMATS: Record<FormatId, { mime: string; extensions: string[]; label: string }> = {
  pdf: { mime: "application/pdf", extensions: ["pdf"], label: "PDF" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extensions: ["docx"], label: "Word (.docx)" },
  doc: { mime: "application/msword", extensions: ["doc"], label: "Word (.doc)" },
  jpeg: { mime: "image/jpeg", extensions: ["jpg", "jpeg"], label: "JPG" },
  png: { mime: "image/png", extensions: ["png"], label: "PNG" },
  webp: { mime: "image/webp", extensions: ["webp"], label: "WebP" },
};

export const FILE_RULES: Record<FileKind, { bucket: string; maxBytes: number; formats: FormatId[] }> = {
  document: { bucket: "documents", maxBytes: 10 * 1024 * 1024, formats: ["pdf", "docx", "doc", "jpeg", "png"] },
  avatar: { bucket: "avatars", maxBytes: 2 * 1024 * 1024, formats: ["jpeg", "png", "webp"] },
};

export const DOCUMENT_TYPES = ["cv", "transcript", "certificate", "cover_letter", "portfolio", "other"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Types where a new upload replaces the previous file. */
export const SINGLE_FILE_TYPES: readonly DocumentType[] = ["cv", "transcript", "cover_letter"];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  cv: "CV",
  transcript: "Academic transcript",
  certificate: "Certificate",
  cover_letter: "Cover letter",
  portfolio: "Portfolio",
  other: "Other document",
};

export function acceptAttribute(kind: FileKind): string {
  const f = FILE_RULES[kind].formats.map((id) => FORMATS[id]);
  return [...f.map((x) => x.mime), ...f.flatMap((x) => x.extensions.map((e) => `.${e}`))].join(",");
}

export function formatsLabel(kind: FileKind): string {
  return FILE_RULES[kind].formats.map((id) => FORMATS[id].label).join(", ");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

/** Format matching a file name's extension and declared MIME type, if allowed for this kind. */
export function formatFor(kind: FileKind, fileName: string, mimeType: string): FormatId | null {
  const ext = extensionOf(fileName);
  const found = FILE_RULES[kind].formats.find((id) => FORMATS[id].extensions.includes(ext));
  if (!found) return null;
  // Browsers sometimes send an empty or generic type; the content check is authoritative.
  if (mimeType && mimeType !== "application/octet-stream" && mimeType !== FORMATS[found].mime) return null;
  return found;
}

export function mimeFor(format: FormatId): string {
  return FORMATS[format].mime;
}

export function extensionFor(format: FormatId): string {
  return FORMATS[format].extensions[0];
}

/** Check name, declared type and size before uploading. Returns an error message or null. */
export function checkFileMeta(kind: FileKind, file: { name: string; size: number; type: string }): string | null {
  const rules = FILE_RULES[kind];
  if (!formatFor(kind, file.name, file.type)) return `This file type is not accepted. Use ${formatsLabel(kind)}.`;
  if (file.size <= 0) return "This file is empty.";
  if (file.size > rules.maxBytes) return `This file is too large. The maximum is ${formatBytes(rules.maxBytes)}.`;
  return null;
}

/**
 * Identify a file from its first bytes ("magic numbers"), so a renamed
 * executable cannot pass as a PDF. Needs at least 12 bytes.
 */
export function sniffFormat(bytes: Uint8Array): FormatId | "zip" | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (starts([0xff, 0xd8, 0xff])) return "jpeg";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "webp"; // RIFF....WEBP
  if (starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "doc"; // OLE2
  if (starts([0x50, 0x4b, 0x03, 0x04])) return "zip"; // .docx is a zip container
  return null;
}

/** True if the file's content matches the format its name claims. */
export function contentMatches(expected: FormatId, bytes: Uint8Array): boolean {
  const actual = sniffFormat(bytes);
  if (expected === "docx") return actual === "zip";
  return actual === expected;
}

/** A safe, short display name derived from the original file name. */
export function cleanFileName(name: string): string {
  const cleaned = name.replace(/[\\/\u0000-\u001f<>:"|?*]+/g, "").replace(/\s+/g, " ").trim();
  return (cleaned || "document").slice(0, 120);
}
