import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Create the caller's student profile only when they have no workspace of any kind. */
export async function ensureStudentProfile(supabase: Client): Promise<"created" | "skipped"> {
  const { data: contexts, error } = await supabase.rpc("my_contexts");
  if (error || !contexts) return "skipped";
  const c = contexts as { account_status: string; student: unknown; admin_role: unknown; companies: unknown[] };
  if (c.account_status !== "active" || c.student || c.admin_role || c.companies.length > 0) return "skipped";
  const { error: createError } = await supabase.rpc("create_student_profile");
  if (createError && createError.code !== "23505") {
    console.error("create_student_profile failed", createError.code, createError.message);
    return "skipped";
  }
  return "created";
}
