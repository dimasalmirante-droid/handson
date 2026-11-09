"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { finalizeUpload, prepareUpload } from "@/app/(app)/files/actions";
import { FILE_RULES, checkFileMeta, contentMatches, formatFor, type FileKind } from "@/lib/files";
import { createClient } from "@/lib/supabase/client";

export type UploadState =
  | { phase: "idle" }
  | { phase: "checking" | "uploading" | "verifying"; fileName: string }
  | { phase: "done"; fileName: string }
  | { phase: "error"; message: string };

/**
 * Upload flow: check locally → get a one-time upload URL from the server →
 * upload directly to private storage → server verifies and records the file.
 */
export function useUpload(kind: FileKind, documentType?: string) {
  const router = useRouter();
  const [state, setState] = useState<UploadState>({ phase: "idle" });

  async function upload(file: File, title?: string): Promise<boolean> {
    const fail = (message: string) => {
      setState({ phase: "error", message });
      return false;
    };

    setState({ phase: "checking", fileName: file.name });
    const metaError = checkFileMeta(kind, file);
    if (metaError) return fail(metaError);
    const format = formatFor(kind, file.name, file.type)!;
    const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    if (!contentMatches(format, head)) {
      return fail("This file's content does not match its type. Please choose a genuine PDF, Word or image file.");
    }

    try {
      const ticket = await prepareUpload({ kind, documentType, fileName: file.name, size: file.size, mimeType: file.type });
      if (!ticket.ok) return fail(ticket.error);

      setState({ phase: "uploading", fileName: file.name });
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(FILE_RULES[kind].bucket)
        .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type || undefined });
      if (error) return fail("The upload failed. Check your connection and try again.");

      setState({ phase: "verifying", fileName: file.name });
      const result = await finalizeUpload({ kind, path: ticket.path, documentType, originalName: file.name, title });
      if (!result.ok) return fail(result.error);

      setState({ phase: "done", fileName: file.name });
      router.refresh();
      return true;
    } catch {
      return fail("Connection problem. Please try again.");
    }
  }

  return { state, upload, reset: () => setState({ phase: "idle" }) };
}

export function uploadStatusText(state: UploadState): string | null {
  switch (state.phase) {
    case "checking":
      return `Checking ${state.fileName}…`;
    case "uploading":
      return `Uploading ${state.fileName}…`;
    case "verifying":
      return `Verifying ${state.fileName}…`;
    case "done":
      return `${state.fileName} uploaded.`;
    default:
      return null;
  }
}
