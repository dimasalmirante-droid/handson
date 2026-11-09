"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth/session";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  FILE_RULES,
  SINGLE_FILE_TYPES,
  checkFileMeta,
  cleanFileName,
  contentMatches,
  extensionFor,
  formatFor,
  type DocumentType,
  type FileKind,
} from "@/lib/files";
import { createClient } from "@/lib/supabase/server";

export type UploadTicket = { ok: true; path: string; token: string } | { ok: false; error: string };
export type FileResult = { ok: true; id?: string } | { ok: false; error: string };

const MAX_DOCUMENTS = 30;
const GENERIC = "The upload could not be completed. Please try again.";

function isDocumentType(v: unknown): v is DocumentType {
  return typeof v === "string" && (DOCUMENT_TYPES as readonly string[]).includes(v);
}

function refresh() {
  revalidatePath("/onboarding", "layout");
  revalidatePath("/dashboard", "layout");
}

/**
 * Step 1: check the file's name, type and size, choose its storage path and
 * issue a one-time upload URL for the student's own folder. The browser then
 * uploads directly to storage (avoiding hosting request-size limits).
 */
export async function prepareUpload(input: {
  kind: FileKind;
  documentType?: string;
  fileName: string;
  size: number;
  mimeType: string;
}): Promise<UploadTicket> {
  const user = await requireStudent();
  const metaError = checkFileMeta(input.kind, { name: input.fileName, size: input.size, type: input.mimeType });
  if (metaError) return { ok: false, error: metaError };
  const format = formatFor(input.kind, input.fileName, input.mimeType)!;

  const supabase = await createClient();
  let folder: string;
  if (input.kind === "document") {
    if (!isDocumentType(input.documentType)) return { ok: false, error: "Choose the type of document." };
    const { count } = await supabase.from("documents").select("id", { count: "exact", head: true }).eq("profile_id", user.id);
    const replacing = SINGLE_FILE_TYPES.includes(input.documentType);
    if (!replacing && (count ?? 0) >= MAX_DOCUMENTS) {
      return { ok: false, error: `You can store up to ${MAX_DOCUMENTS} documents. Remove one to add another.` };
    }
    folder = input.documentType;
  } else {
    folder = "avatar";
  }

  const path = `${user.id}/${folder}/${crypto.randomUUID()}.${extensionFor(format)}`;
  const { data, error } = await supabase.storage.from(FILE_RULES[input.kind].bucket).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("createSignedUploadUrl failed", error?.message);
    return { ok: false, error: GENERIC };
  }
  return { ok: true, path: data.path, token: data.token };
}

/** Reject if a step takes longer than `ms`, so a stalled request cannot hang the upload. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** First bytes of a stored file, for the content check (files are at most 10 MB). */
async function readHead(bucket: string, path: string): Promise<Uint8Array | null> {
  const supabase = await createClient();
  const { data, error } = await withTimeout(supabase.storage.from(bucket).download(path), 20_000, "download");
  if (error || !data) {
    console.error("storage download failed", error?.message);
    return null;
  }
  return new Uint8Array(await data.slice(0, 32).arrayBuffer());
}

/**
 * Step 2: after the browser upload, verify the stored file (owner folder,
 * size, declared type and actual content) and record it. Files that fail
 * any check are deleted.
 */
export async function finalizeUpload(input: {
  kind: FileKind;
  path: string;
  documentType?: string;
  originalName: string;
  title?: string;
}): Promise<FileResult> {
  const user = await requireStudent();
  const supabase = await createClient();
  const rules = FILE_RULES[input.kind];
  const bucket = supabase.storage.from(rules.bucket);

  const folder = input.kind === "document" ? input.documentType : "avatar";
  if (input.kind === "document" && !isDocumentType(folder)) return { ok: false, error: GENERIC };
  const expected = new RegExp(`^${user.id}/${folder}/[0-9a-f-]{36}\\.[a-z]{3,4}$`);
  if (!expected.test(input.path)) return { ok: false, error: GENERIC };

  const reject = async (message: string): Promise<FileResult> => {
    await bucket.remove([input.path]).catch(() => {});
    return { ok: false, error: message };
  };

  try {
    return await verifyAndRecord();
  } catch (e) {
    console.error("finalizeUpload failed", input.kind, e instanceof Error ? e.message : e);
    return reject("We could not verify the file. Please try again.");
  }

  async function verifyAndRecord(): Promise<FileResult> {

  const { data: info, error: infoError } = await withTimeout(bucket.info(input.path), 15_000, "info");
  if (infoError || !info) {
    console.error("storage info failed", infoError?.message);
    return { ok: false, error: GENERIC };
  }
  const size = info.size ?? 0;
  const contentType = info.contentType ?? "";
  const format = formatFor(input.kind, input.path, contentType);
  if (!format) return reject("This file type is not accepted.");
  if (size <= 0 || size > rules.maxBytes) return reject("This file is empty or too large.");

  const head = await readHead(rules.bucket, input.path);
  if (!head) return reject(GENERIC);
  if (!contentMatches(format, head)) {
    return reject("This file's content does not match its type. Please upload a genuine PDF, Word or image file.");
  }

  if (input.kind === "avatar") {
    const { data: previous } = await supabase.from("profiles").select("photo_path").eq("id", user.id).single();
    const { error } = await supabase.from("profiles").update({ photo_path: input.path }).eq("id", user.id);
    if (error) return reject(GENERIC);
    if (previous?.photo_path && previous.photo_path !== input.path) await bucket.remove([previous.photo_path]);
    refresh();
    return { ok: true };
  }

  const documentType = folder as DocumentType;
  const originalName = cleanFileName(input.originalName);
  const title = (input.title?.trim() || DOCUMENT_TYPE_LABELS[documentType]).slice(0, 150);

  const { data: previous } = SINGLE_FILE_TYPES.includes(documentType)
    ? await supabase.from("documents").select("id, storage_path").eq("profile_id", user.id).eq("document_type", documentType)
    : { data: [] as { id: string; storage_path: string }[] };

  const { data: row, error } = await supabase
    .from("documents")
    .insert({
      profile_id: user.id,
      document_type: documentType,
      title,
      storage_path: input.path,
      original_filename: originalName,
      mime_type: contentType,
      size_bytes: size,
    })
    .select("id")
    .single();
  if (error || !row) {
    console.error("documents insert failed", error?.code, error?.message);
    return reject(error?.code === "P0001" ? `You can store up to ${MAX_DOCUMENTS} documents.` : GENERIC);
  }

  // Replace the previous CV / transcript / cover letter.
  if (previous && previous.length) {
    await supabase.from("documents").delete().in("id", previous.map((p) => p.id));
    await bucket.remove(previous.map((p) => p.storage_path));
  }

  refresh();
  return { ok: true, id: row.id };
  }
}

export async function deleteDocument(id: string): Promise<FileResult> {
  const user = await requireStudent();
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("id", id)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!doc) return { ok: false, error: "Document not found." };

  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) return { ok: false, error: "The document could not be removed. Please try again." };
  await supabase.storage.from("documents").remove([doc.storage_path]);
  refresh();
  return { ok: true };
}

export async function removePhoto(): Promise<FileResult> {
  const user = await requireStudent();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("photo_path").eq("id", user.id).single();
  if (!data?.photo_path) return { ok: true };
  const { error } = await supabase.from("profiles").update({ photo_path: null }).eq("id", user.id);
  if (error) return { ok: false, error: "The photo could not be removed. Please try again." };
  await supabase.storage.from("avatars").remove([data.photo_path]);
  refresh();
  return { ok: true };
}
