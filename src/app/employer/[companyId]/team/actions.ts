"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyRole } from "@/lib/auth/company";
import { companyTeamInvitationSchema } from "@/lib/invitations/validation";
import { invitationExpiry, generateInvitationToken } from "@/lib/invitations/token";
import { companyTeamInvitationEmail } from "@/lib/invitations/email-content";
import { InvitationEmailError, sendInvitationEmail } from "@/lib/invitations/email-provider";
import { requestOrigin } from "@/lib/auth/origin";
import { createClient } from "@/lib/supabase/server";

export type CompanyTeamActionState = {
  ok?: boolean;
  warning?: boolean;
  message?: string;
};

type TeamRole = "reviewer" | "company_admin";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function databaseMessage(error: { code?: string; message: string }, fallback: string): string {
  if (error.code === "42501") return "You do not have permission to manage this company team.";
  if (error.code === "P0002" || error.code === "22023") return error.message;
  console.error("company team action failed", error.code);
  return fallback;
}

function revalidateTeam(companyId: string) {
  revalidatePath("/employer/" + companyId + "/team");
  revalidatePath("/employer/" + companyId);
}

async function loadCompany(supabase: Awaited<ReturnType<typeof createClient>>, companyId: string) {
  return supabase
    .from("companies")
    .select("id,name,status")
    .eq("id", companyId)
    .maybeSingle();
}

async function sendTeamInvitationEmail(input: {
  invitationId: string;
  token: string;
  tokenHash: string;
  email: string;
  fullName: string | null;
  role: TeamRole;
  companyName: string;
  expiresAt: Date;
}): Promise<string | null> {
  const origin = await requestOrigin();
  const inviteUrl = origin + "/invite/" + encodeURIComponent(input.token);
  const message = companyTeamInvitationEmail({
    companyName: input.companyName,
    fullName: input.fullName ?? "",
    role: input.role,
    inviteUrl,
    expiresAt: input.expiresAt,
  });

  try {
    await sendInvitationEmail({
      to: input.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
      idempotencyKey: "company-team-invitation-" + input.invitationId + "-" + input.tokenHash.slice(0, 16),
    });
  } catch (error) {
    if (error instanceof InvitationEmailError) return error.message;
    console.error("company team invitation email failed");
    return "The invitation email could not be sent. Please try again.";
  }

  return null;
}

async function markInvitationSent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invitationId: string,
): Promise<boolean> {
  const { error } = await supabase.rpc("company_mark_invitation_sent", { p_invitation: invitationId });
  if (error) {
    console.error("company_mark_invitation_sent failed", error.code);
    return false;
  }
  return true;
}

/** Invite a colleague as Reviewer or Company Administrator. */
export async function inviteCompanyMember(
  companyId: string,
  _previous: CompanyTeamActionState,
  formData: FormData,
): Promise<CompanyTeamActionState> {
  if (!UUID.test(companyId)) return { message: "Invalid company." };
  await requireCompanyRole(companyId, "company_admin");

  if (!process.env.RESEND_API_KEY) {
    return {
      warning: true,
      message: "Email sending is not configured in this environment. Add RESEND_API_KEY in Vercel before sending invitations.",
    };
  }

  const parsed = companyTeamInvitationSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    jobTitle: String(formData.get("jobTitle") ?? ""),
    role: String(formData.get("role") ?? ""),
  });
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Check the colleague details and try again." };
  }

  const supabase = await createClient();
  const { data: company, error: companyError } = await loadCompany(supabase, companyId);
  if (companyError || !company) return { message: "This company workspace could not be found." };
  if (company.status === "suspended") {
    return { message: "This company workspace is suspended. Invitations cannot be sent." };
  }

  const token = generateInvitationToken();
  const expiresAt = invitationExpiry();
  const { data: invitationId, error } = await supabase.rpc("company_invite_member", {
    p_company: companyId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_full_name: parsed.data.fullName,
    p_job_title: parsed.data.jobTitle,
    p_token_hash: token.hash,
    p_expires_at: expiresAt.toISOString(),
  });

  if (error || typeof invitationId !== "string") {
    return {
      message: error
        ? databaseMessage(error, "The colleague invitation could not be created.")
        : "The colleague invitation could not be created.",
    };
  }

  const emailError = await sendTeamInvitationEmail({
    invitationId,
    token: token.token,
    tokenHash: token.hash,
    email: parsed.data.email,
    fullName: parsed.data.fullName,
    role: parsed.data.role,
    companyName: company.name,
    expiresAt,
  });

  if (emailError) {
    revalidateTeam(companyId);
    return {
      warning: true,
      message: "The invitation was created, but the email was not submitted: " + emailError + " Use Retry email to send a fresh link.",
    };
  }

  const recorded = await markInvitationSent(supabase, invitationId);
  revalidateTeam(companyId);
  return {
    ok: true,
    message: recorded
      ? "Resend accepted the invitation email request for " + parsed.data.email + ". The link is valid for seven days."
      : "Resend accepted the email request, but the send record could not be updated. Refresh before retrying.",
  };
}

/** Rotate a pending invitation's token and submit a fresh email. */
export async function resendCompanyInvitation(
  companyId: string,
  _previous: CompanyTeamActionState,
  formData: FormData,
): Promise<CompanyTeamActionState> {
  if (!UUID.test(companyId)) return { message: "Invalid company." };
  await requireCompanyRole(companyId, "company_admin");

  if (!process.env.RESEND_API_KEY) {
    return {
      warning: true,
      message: "Email sending is not configured in this environment. Add RESEND_API_KEY in Vercel before retrying.",
    };
  }

  const invitationId = String(formData.get("invitationId") ?? "");
  if (!UUID.test(invitationId)) return { message: "Invalid invitation." };

  const supabase = await createClient();
  const { data: invitation, error: invitationError } = await supabase
    .from("company_invitations")
    .select("id,company_id,email,role,full_name,status,expires_at")
    .eq("id", invitationId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (invitationError || !invitation) return { message: "This invitation could not be found." };
  if (invitation.status !== "pending") return { message: "Only a pending invitation can be resent." };
  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    return { warning: true, message: "This invitation has expired. Use the form below to issue a fresh invitation." };
  }

  const { data: company, error: companyError } = await loadCompany(supabase, companyId);
  if (companyError || !company) return { message: "This company workspace could not be found." };
  if (company.status === "suspended") return { message: "This company workspace is suspended." };

  const token = generateInvitationToken();
  const expiresAt = invitationExpiry();
  const { error } = await supabase.rpc("company_resend_invitation", {
    p_invitation: invitationId,
    p_token_hash: token.hash,
    p_expires_at: expiresAt.toISOString(),
  });
  if (error) return { message: databaseMessage(error, "The invitation could not be prepared for resend.") };

  const role: TeamRole = invitation.role === "company_admin" ? "company_admin" : "reviewer";
  const emailError = await sendTeamInvitationEmail({
    invitationId,
    token: token.token,
    tokenHash: token.hash,
    email: invitation.email,
    fullName: invitation.full_name,
    role,
    companyName: company.name,
    expiresAt,
  });

  if (emailError) {
    revalidateTeam(companyId);
    return {
      warning: true,
      message: "The previous link has been invalidated, but the new email was not submitted: " + emailError + " Retry to send another link.",
    };
  }

  const recorded = await markInvitationSent(supabase, invitationId);
  revalidateTeam(companyId);
  return {
    ok: true,
    message: recorded
      ? "Resend accepted a fresh invitation email request for " + invitation.email + ". The previous link no longer works."
      : "Resend accepted the email request, but the send record could not be updated. Refresh before retrying.",
  };
}

/** Revoke an unaccepted invitation for this company. */
export async function revokeCompanyInvitation(
  companyId: string,
  _previous: CompanyTeamActionState,
  formData: FormData,
): Promise<CompanyTeamActionState> {
  if (!UUID.test(companyId)) return { message: "Invalid company." };
  await requireCompanyRole(companyId, "company_admin");
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!UUID.test(invitationId)) return { message: "Invalid invitation." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("company_revoke_invitation", { p_invitation: invitationId });
  if (error) return { message: databaseMessage(error, "The invitation could not be revoked.") };

  revalidateTeam(companyId);
  return { ok: true, message: "The invitation has been revoked. Its link can no longer be used." };
}

/** Change a team member's role. The database protects the final Company Administrator. */
export async function changeCompanyMemberRole(
  companyId: string,
  _previous: CompanyTeamActionState,
  formData: FormData,
): Promise<CompanyTeamActionState> {
  if (!UUID.test(companyId)) return { message: "Invalid company." };
  await requireCompanyRole(companyId, "company_admin");

  const userId = String(formData.get("userId") ?? "");
  const roleValue = String(formData.get("role") ?? "");
  if (!UUID.test(userId)) return { message: "Invalid team member." };
  if (roleValue !== "reviewer" && roleValue !== "company_admin") {
    return { message: "Choose Reviewer or Company Administrator." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("company_change_member_role", {
    p_company: companyId,
    p_user: userId,
    p_role: roleValue as TeamRole,
  });
  if (error) return { message: databaseMessage(error, "The team member's role could not be updated.") };

  revalidateTeam(companyId);
  return { ok: true, message: "Team member access updated." };
}

/** Remove a teammate. The database protects the final Company Administrator. */
export async function removeCompanyMember(
  companyId: string,
  _previous: CompanyTeamActionState,
  formData: FormData,
): Promise<CompanyTeamActionState> {
  if (!UUID.test(companyId)) return { message: "Invalid company." };
  await requireCompanyRole(companyId, "company_admin");

  const userId = String(formData.get("userId") ?? "");
  if (!UUID.test(userId)) return { message: "Invalid team member." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("company_remove_member", {
    p_company: companyId,
    p_user: userId,
  });
  if (error) return { message: databaseMessage(error, "The team member could not be removed.") };

  revalidateTeam(companyId);
  return { ok: true, message: "The team member has been removed from this company workspace." };
}
