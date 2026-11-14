"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WORKSPACE_COOKIE, getContexts } from "@/lib/auth/contexts";
import { listWorkspaces } from "@/lib/auth/destination";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** Open one of the person's workspaces and remember it for next time. Only their own workspaces are accepted. */
export async function switchWorkspace(formData: FormData): Promise<void> {
  await requireUser("/workspaces");
  const key = String(formData.get("workspace") ?? "");
  const contexts = await getContexts();
  const target = contexts ? listWorkspaces(contexts).find((w) => w.key === key) : undefined;
  if (!target) redirect("/workspaces");
  const store = await cookies();
  store.set(WORKSPACE_COOKIE, target.key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  redirect(target.href);
}

export type CreateProfileState = { error?: string };

/** Create the signed-in person's own student profile, then continue to onboarding. Independent of any invitation. */
export async function createStudentProfileAction(_prev: CreateProfileState, formData: FormData): Promise<CreateProfileState> {
  await requireUser("/workspaces");
  if (formData.get("confirm") !== "on") return { error: "Tick the box to confirm you want to create a student profile." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_student_profile");
  if (error && error.code !== "23505") {
    console.error("create_student_profile failed", error.code, error.message);
    return { error: "Your student profile could not be created. Please try again." };
  }
  const store = await cookies();
  store.set(WORKSPACE_COOKIE, "student", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  redirect("/onboarding");
}
