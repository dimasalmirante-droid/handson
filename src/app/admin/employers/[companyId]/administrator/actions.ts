"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { invitationExpiry, generateInvitationToken } from "@/lib/invitations/token";
import { firstCompanyAdminInvitationEmail } from "@/lib/invitations/email-content";
import { InvitationEmailError, sendInvitationEmail } from "@/lib/invitations/email-provider";
import { firstCompanyAdminInvitationSchema } from "@/lib/invitations/validation";
import { requestOrigin } from "@/lib/auth/origin";
import { createClient } from "@/lib/supabase/server";

export type CompanyAdminInvitationActionState = {
  ok?: boolean;
  message?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID.test(value);
}

function databaseMessage(error: { code?: string; message: string }, fallback: string): string {
  if (error.code === "42501") return "You do not have permission to manage this invitation.";
  if (error.code === "P0002" || error.code === "22023") return error.message;
  console.error("company administrator invitation action failed", error.code);
  return fallback;
}

async function loadCompany(supabase: Awaited<ReturnType<typeof createClient>>, companyId: string) {
  return supabase
    .from("companies")
    .select("id,name,status")
    .eq("id", companyId)
    .maybeSingle();
}

async function emailInvitation(input: {
  invitationId: string;
  token: string;
  tokenHash: string;
  email: string;
  fullName: string | null;
  companyName: string;
  expiresAt: Date;
}): Promise<string | null> {
  const origin = await requestOrigin();
  const inviteUrl = `${origin}/invite/${encodeURIComponent(input.token)}`;
  const message = firstCompanyAdminInvitationEmail({
    companyName: input.companyName,
    fullName: input.fullName ?? "",
    inviteUrl,
    expiresAt: input.expiresAt,
  });

  try {
    await sendInvitationEmail({
      to: input.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
      idempotencyKey: `company-admin-invitation-${input.invitationId}-${input.tokenHash.slice(0, 16)}`,
    });
  } catch (error) {
    if (error instanceof InvitationEmailError) return error.message;
    console.error("company administrator invitation email failed");
    return "The invitation email could not be sent. Please try again.";
  }

  return null;
}

async function markInvitationSent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invitationId: string,
): Promise<boolean> {
  const { error } = await supabase.rpc("admin_mark_invitation_sent", { p_invitation: invitationId });
  if (error) {
    console.error("admin_mark_invitation_sent failed", error.code);
    return false;
  }
  return true;
}

/** Appoint and email the first Company Admin. No Auth user or membership is created here. */
export async function createFirstCompanyAdminInvitation(
  companyId: string,
  _prev: CompanyAdminInvitationActionState,
  formData: FormData,
): Promise<CompanyAdminInvitationActionState> {
  await requireAdmin("admin");
  if (!isUuid(companyId)) return { message: "Invalid company." };
  if (!process.env.RESEND_API_KEY) {
    return { message: "Email sending is not configured in this environment. Add RESEND_API_KEY to Vercel before sending invitations." };
  }

  const parsed = firstCompanyAdminInvitationSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    jobTitle: String(formData.get("jobTitle") ?? ""),
  });
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Check the administrator's details and try again." };
  }

  const supabase = await createClient();
  const { data: company, error: companyError } = await loadCompany(supabase, companyId);
  if (companyError || !company) return { message: "This employer could not be found." };
  if (company.status === "suspended") return { message: "This employer is suspended. Invitations cannot be sent." };

  const token = generateInvitationToken();
  const expiresAt = invitationExpiry();
  const { data, error } = await supabase.rpc("admin_invite_first_company_admin", {
    p_company: companyId,
    p_email: parsed.data.email,
    p_full_name: parsed.data.fullName,
    p_job_title: parsed.data.jobTitle,
    p_token_hash: token.hash,
    p_expires_at: expiresAt.toISOString(),
  });
  if (error || typeof data !== "string") {
    return { message: error ? databaseMessage(error, "The Company Admin invitation could not be created.") : "The invitation could not be created." };
  }

  const emailError = await emailInvitation({
    invitationId: data,
    token: token.token,
    tokenHash: token.hash,
    email: parsed.data.email,
    fullName: parsed.data.fullName,
    companyName: company.name,
    expiresAt,
  });
  if (emailError) {
    revalidatePath(`/admin/employers/${companyId}/administrator`);
    return { message: `The invitation was created, but the email was not sent: ${emailError} Use Retry email to send a fresh link.` };
  }

  const recorded = await markInvitationSent(supabase, data);
  revalidatePath(`/admin/employers/${companyId}/administrator`);
  revalidatePath("/admin/employers");

  return {
    ok: true,
    message: recorded
      ? `Resend accepted the invitation email request for ${parsed.data.email}. The link is valid for seven days.`
      : "Resend accepted the invitation email request, but its send record could not be updated. Refresh this page before retrying.",
  };
}

/** Rotate the token, invalidate the previous link, and send a fresh invitation email. */
export async function resendFirstCompanyAdminInvitation(
  companyId: string,
  _prev: CompanyAdminInvitationActionState,
  formData: FormData,
): Promise<CompanyAdminInvitationActionState> {
  await requireAdmin("admin");
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!isUuid(companyId) || !isUuid(invitationId)) return { message: "Invalid invitation." };
  if (!process.env.RESEND_API_KEY) {
    return { message: "Email sending is not configured in this environment. Add RESEND_API_KEY to Vercel before sending invitations." };
  }

  const supabase = await createClient();
  const { data: invitation, error: invitationError } = await supabase
    .from("company_invitations")
    .select("id,company_id,email,role,full_name,job_title,status,expires_at")
    .eq("id", invitationId)
    .eq("company_id", companyId)
    .eq("role", "company_admin")
    .maybeSingle();

  if (invitationError || !invitation) return { message: "This invitation could not be found." };
  if (invitation.status !== "pending") return { message: "Only a pending invitation can be resent." };

  const { data: company, error: companyError } = await loadCompany(supabase, companyId);
  if (companyError || !company) return { message: "This employer could not be found." };

  const token = generateInvitationToken();
  const expiresAt = invitationExpiry();
  let replacedExpiredInvitation = new Date(invitation.expires_at).getTime() <= Date.now();
  let targetInvitationId = invitationId;

  if (!replacedExpiredInvitation) {
    const { error } = await supabase.rpc("admin_resend_invitation", {
      p_invitation: invitationId,
      p_token_hash: token.hash,
      p_expires_at: expiresAt.toISOString(),
    });

    // The invitation could expire between the read above and the locked
    // database operation. In that case, create a new invitation below.
    if (error && /expired/i.test(error.message)) {
      replacedExpiredInvitation = true;
    } else if (error) {
      return { message: databaseMessage(error, "The invitation could not be prepared for resend.") };
    }
  }

  if (replacedExpiredInvitation) {
    const { data, error } = await supabase.rpc("admin_invite_first_company_admin", {
      p_company: companyId,
      p_email: invitation.email,
      p_full_name: invitation.full_name,
      p_job_title: invitation.job_title,
      p_token_hash: token.hash,
      p_expires_at: expiresAt.toISOString(),
    });
    if (error || typeof data !== "string") {
      return {
        message: error
          ? databaseMessage(error, "The expired invitation could not be replaced.")
          : "The expired invitation could not be replaced.",
      };
    }
    targetInvitationId = data;
  }

  const emailError = await emailInvitation({
    invitationId: targetInvitationId,
    token: token.token,
    tokenHash: token.hash,
    email: invitation.email,
    fullName: invitation.full_name,
    companyName: company.name,
    expiresAt,
  });
  if (emailError) {
    revalidatePath(`/admin/employers/${companyId}/administrator`);
    return {
      message: replacedExpiredInvitation
        ? `A new invitation was created, but its email was not submitted: ${emailError} Use Retry email to send a fresh link.`
        : `The previous link has been invalidated, but the new email was not submitted: ${emailError} Use Retry email to send another link.`,
    };
  }

  const recorded = await markInvitationSent(supabase, targetInvitationId);
  revalidatePath(`/admin/employers/${companyId}/administrator`);
  revalidatePath("/admin/employers");

  return {
    ok: true,
    message: !recorded
      ? "The invitation email request was accepted, but its send record could not be updated. Refresh before retrying."
      : replacedExpiredInvitation
        ? `The expired invitation was replaced. Resend accepted a new invitation email request for ${invitation.email}.`
        : `Resend accepted a fresh invitation email request for ${invitation.email}. The previous link no longer works.`,
  };
}

/** Revoke an invitation that has not yet been accepted. */
export async function revokeFirstCompanyAdminInvitation(
  companyId: string,
  _prev: CompanyAdminInvitationActionState,
  formData: FormData,
): Promise<CompanyAdminInvitationActionState> {
  await requireAdmin("admin");
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!isUuid(companyId) || !isUuid(invitationId)) return { message: "Invalid invitation." };

  const supabase = await createClient();
  const { data: invitation, error: invitationError } = await supabase
    .from("company_invitations")
    .select("id")
    .eq("id", invitationId)
    .eq("company_id", companyId)
    .eq("role", "company_admin")
    .maybeSingle();
  if (invitationError || !invitation) return { message: "This invitation could not be found." };

  const { error } = await supabase.rpc("admin_revoke_invitation", { p_invitation: invitationId });
  if (error) return { message: databaseMessage(error, "The invitation could not be revoked.") };

  revalidatePath(`/admin/employers/${companyId}/administrator`);
  revalidatePath("/admin/employers");
  return { ok: true, message: "The invitation has been revoked. Its link can no longer be used." };
}
