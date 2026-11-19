"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requestOrigin } from "@/lib/auth/origin";
import { requireStudent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PASSWORD_MIN } from "@/lib/validation/auth";
import { publicProfileSchema } from "@/lib/validation/profile";

export type SettingsResult = { ok: boolean; message?: string; fields?: Partial<Record<string, string>> };

/** Current version of the employer-visibility consent wording. Bump when it changes. */
const VISIBILITY_CONSENT_VERSION = "2026-11";

export async function setEmployerVisibility(granted: boolean): Promise<SettingsResult> {
  await requireStudent("/dashboard/settings");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_employer_visibility", { p_granted: granted, p_version: VISIBILITY_CONSENT_VERSION });
  if (error) {
    console.error("set_employer_visibility failed", error.message);
    return { ok: false, message: "Your privacy setting could not be changed. Please try again." };
  }
  revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    message: granted
      ? "Your profile can now be shown to verified employers when that feature opens."
      : "Your profile is private. Employers cannot see it.",
  };
}

/** Current version of the public-profile consent wording. Bump when it changes. */
const PUBLIC_PROFILE_CONSENT_VERSION = "2026-11";

export async function setPublicProfile(input: { enabled: boolean; slug: string; sections: string[] }): Promise<SettingsResult & { slug?: string | null }> {
  await requireStudent("/dashboard/settings");
  const parsed = publicProfileSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Partial<Record<string, string>> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;
    return { ok: false, fields };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_public_profile", {
    p_enabled: parsed.data.enabled,
    p_slug: parsed.data.slug || null,
    p_sections: parsed.data.sections,
    p_version: PUBLIC_PROFILE_CONSENT_VERSION,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, fields: { slug: "This address is already taken. Try another." } };
    if (error.code === "22023") return { ok: false, fields: { slug: "This address is not available. Try another." } };
    console.error("set_public_profile failed", error.code, error.message);
    return { ok: false, message: "Your public profile could not be updated. Please try again." };
  }
  revalidatePath("/dashboard", "layout");
  if (data) revalidatePath(`/p/${data}`);
  return {
    ok: true,
    slug: (data as string | null) ?? null,
    message: parsed.data.enabled ? "Your public profile is live. Share the link with employers." : "Your public profile is off. The link no longer works.",
  };
}

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
});

export async function changeEmail(_prev: SettingsResult, formData: FormData): Promise<SettingsResult> {
  const user = await requireStudent("/dashboard/settings");
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, fields: { email: parsed.error.issues[0].message } };
  if (parsed.data.email === user.email.toLowerCase()) {
    return { ok: false, fields: { email: "This is already your email address." } };
  }

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${origin}/auth/confirm?next=/dashboard/settings` },
  );
  if (error) {
    if (error.code === "email_exists") return { ok: false, fields: { email: "This email cannot be used. Try another address." } };
    if (error.status === 429) return { ok: false, message: "Too many requests. Please wait a few minutes and try again." };
    console.error("updateUser email failed", error.code, error.message);
    return { ok: false, message: "Your email could not be changed. Please try again." };
  }
  return {
    ok: true,
    message: `We sent a confirmation link to ${parsed.data.email}. Your email changes once you confirm it. You may also need to confirm from your current address.`,
  };
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
      .max(72, "Use 72 characters or fewer.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/[0-9]/, "Include at least one number."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a password different from your current one." });

export async function changePassword(_prev: SettingsResult, formData: FormData): Promise<SettingsResult> {
  const user = await requireStudent("/dashboard/settings");
  const parsed = passwordSchema.safeParse(Object.fromEntries(["currentPassword", "newPassword", "confirmPassword"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { ok: false, fields };
  }

  const supabase = await createClient();
  // Confirm the current password before changing it.
  const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.currentPassword });
  if (authError) {
    if (authError.status === 429) return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };
    return { ok: false, fields: { currentPassword: "Your current password is incorrect." } };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) {
    if (error.code === "weak_password") return { ok: false, fields: { newPassword: "Choose a stronger password." } };
    console.error("updateUser password failed", error.code, error.message);
    return { ok: false, message: "Your password could not be changed. Please try again." };
  }
  return { ok: true, message: "Your password has been changed." };
}
