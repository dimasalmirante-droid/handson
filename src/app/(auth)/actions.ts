"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { googleCallbackUrl } from "@/lib/auth/oauth";
import { describeRequest, hostOf } from "@/lib/auth/oauth-diagnostics";
import { requestOrigin } from "@/lib/auth/origin";
import { safeNextPath } from "@/lib/auth/redirects";
import { getCurrentLegalDocuments } from "@/lib/data/legal";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrors,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type FieldErrors,
} from "@/lib/validation/auth";

export type FormState = {
  error?: string;
  fields?: FieldErrors;
  values?: Record<string, string>;
  success?: string;
};

const GENERIC_ERROR ="Something went wrong. Please try again in a moment.";

function pick(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

/* ------------------------------------------------------------------ */
/* Register with email and password                                    */
/* ------------------------------------------------------------------ */

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = pick(formData, ["firstName", "surname", "email", "password", "acceptTerms", "acknowledgePrivacy", "legalTermsId", "legalPrivacyId", "next"]);
  const parsed = registerSchema.safeParse(raw);
  const values = { firstName: raw.firstName, surname: raw.surname, email: raw.email };
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  // When final Terms and Privacy Notice are in force, the form shows them by
  // version and asks for acceptance and acknowledgement separately. Only the
  // exact current versions are recorded (the database checks again).
  const legal = await getCurrentLegalDocuments();
  const metadataLegal: Record<string, string> = {};
  if (legal.terms && legal.privacy) {
    if (raw.acknowledgePrivacy !== "on") {
      return { fields: { acknowledgePrivacy: "Confirm that you have read the Privacy Notice." }, values };
    }
    if (raw.legalTermsId !== legal.terms.id || raw.legalPrivacyId !== legal.privacy.id) {
      return { error: "The Terms or Privacy Notice have just been updated. Please review them and try again.", values };
    }
    metadataLegal.legal_terms_id = legal.terms.id;
    metadataLegal.legal_privacy_id = legal.privacy.id;
  }

  const { firstName, surname, email, password } = parsed.data;
  const supabase = await createClient();
  const origin = await requestOrigin();
  const next = safeNextPath(raw.next, "/onboarding");

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      // signup_intent marks a student registration: the sign-up trigger then
      // creates a student profile even if an employer invitation is pending.
      // It can only add a profile for the person themselves; it grants nothing.
      data: { first_name: firstName, surname, signup_intent: "student", ...metadataLegal },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return { fields: { password: "Choose a stronger password." }, values };
    }
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return { error: "Too many attempts. Please wait a few minutes and try again.", values };
    }
    console.error("signUp failed", error.code, error.message);
    return { error: GENERIC_ERROR, values };
  }

  // Same outcome whether or not the email already has an account, so the form
  // cannot be used to discover who is registered.
  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

/* ------------------------------------------------------------------ */
/* Log in with email and password                                      */
/* ------------------------------------------------------------------ */

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = pick(formData, ["email", "password", "next"]);
  const parsed = loginSchema.safeParse(raw);
  const values = { email: raw.email };
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        error: "Please verify your email address first. Check your inbox for the verification link.",
        values,
      };
    }
    if (error.code === "invalid_credentials") {
      return { error: "Incorrect email or password.", values };
    }
    if (error.status === 429) {
      return { error: "Too many attempts. Please wait a few minutes and try again.", values };
    }
    console.error("signIn failed", error.code, error.message);
    return { error: GENERIC_ERROR, values };
  }

  // Defence in depth: never accept an unverified email as signed in.
  if (!data.user?.email_confirmed_at) {
    await supabase.auth.signOut();
    return { error: "Please verify your email address first.", values };
  }

  redirect(raw.next ? safeNextPath(raw.next, "/start") : "/start");
}

/* ------------------------------------------------------------------ */
/* Continue with Google                                                */
/* ------------------------------------------------------------------ */

export async function googleAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const origin = await requestOrigin();
  // intent=student is set only by the student registration page. After
  // sign-in, the callback creates a student profile for a new account that
  // has no workspace yet.
  const callback = googleCallbackUrl(origin, {
    next: String(formData.get("next") ?? ""),
    intent: String(formData.get("intent") ?? ""),
  });

  // TEMPORARY diagnostics: hosts and deployment only (no cookies/query/form).
  const hdrs = await headers();
  const diag = describeRequest(hdrs);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback,
      queryParams: { prompt: "select_account" },
    },
  });

  console.error("[oauth-diag] googleAction", {
    ...diag,
    derivedOriginHost: hostOf(origin),
    callbackHost: hostOf(callback),
    authorizeRedirectToHost: data?.url ? hostOf(new URL(data.url).searchParams.get("redirect_to") ?? "") : null,
    errorCode: error?.code,
  });

  if (error || !data.url) {
    console.error("Google sign-in failed", error?.code, error?.message);
    redirect("/login?error=google");
  }
  redirect(data.url);
}

/* ------------------------------------------------------------------ */
/* Password reset                                                      */
/* ------------------------------------------------------------------ */

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = pick(formData, ["email"]);
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values: raw };

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  if (error && error.status === 429) {
    return { error: "Too many requests. Please wait a few minutes and try again.", values: raw };
  }
  if (error) console.error("resetPasswordForEmail failed", error.code, error.message);

  // Same message either way, so the form does not reveal registered emails.
  return {
    success: "If an account exists for that email, we have sent a link to reset your password. The link expires in one hour.",
  };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = pick(formData, ["password", "confirmPassword"]);
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { error: "Your reset link has expired. Please request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { fields: { password: "Choose a password different from your current one." } };
    }
    if (error.code === "weak_password") {
      return { fields: { password: "Choose a stronger password." } };
    }
    console.error("updateUser failed", error.code, error.message);
    return { error: GENERIC_ERROR };
  }

  redirect("/start?notice=password-updated");
}

/* ------------------------------------------------------------------ */
/* Sign out                                                            */
/* ------------------------------------------------------------------ */

/** Always available: never checks suspension, legal acceptance or workspaces. */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?notice=signed-out");
}
