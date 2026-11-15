"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type AcceptInvitationState = { message?: string };

const HASH = /^[0-9a-f]{64}$/;

export async function acceptCompanyInvitation(
  _prev: AcceptInvitationState,
  _formData: FormData,
): Promise<AcceptInvitationState> {
  await requireUser("/invite");
  const store = await cookies();
  const tokenHash = store.get("hs_company_invitation")?.value;

  if (!tokenHash || !HASH.test(tokenHash)) {
    return { message: "This invitation link is missing or invalid. Open the original invitation email again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token_hash: tokenHash });
  if (error) {
    if (error.code === "42501" && /different email/i.test(error.message)) {
      return { message: "This invitation was sent to a different email address. Sign out and use the account for the invited email address." };
    }
    if (error.code === "42501" && /verify your email/i.test(error.message)) {
      return { message: "Verify your email address before accepting this invitation." };
    }
    if (error.code === "P0002" || error.code === "22023" || error.code === "42501") {
      return { message: error.message };
    }
    console.error("accept_invitation failed", error.code);
    return { message: "The invitation could not be accepted. Please try again or contact Handson support." };
  }

  store.set("hs_company_invitation", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/invite",
    maxAge: 0,
  });
  redirect("/workspaces");
}
