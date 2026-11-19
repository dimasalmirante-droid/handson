import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/feedback";
import { AcceptCompanyInvitationForm } from "@/components/workspaces/accept-company-invitation";
import { signOutForInvitation } from "@/app/invite/actions";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { T } from "@/i18n/client";

export const metadata: Metadata = {
  title: "Employer invitation",
  robots: { index: false, follow: false },
};

type InvitationPreview = {
  company_name: string;
  role: "viewer" | "editor" | "company_admin";
  email_hint: string;
  expires_at: string;
  status: "pending" | "accepted" | "expired" | "revoked";
};

const roleLabel: Record<InvitationPreview["role"], string> = {
  viewer: "Viewer",
  editor: "Editor",
  company_admin: "Company Administrator",
};

const expiryDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Maputo",
  });

export default async function InvitationPage({
  searchParams,
}: PageProps<"/invite">) {
  const sp = await searchParams;
  const store = await cookies();
  const tokenHash = store.get("hs_company_invitation")?.value;
  const user = await getCurrentUser();

  if (user) await requireUser("/invite");

  let invitation: InvitationPreview | null = null;
  let lookupFailed = false;

  if (tokenHash && /^[0-9a-f]{64}$/.test(tokenHash)) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("invitation_preview", { p_token_hash: tokenHash });
    if (error) {
      console.error("invitation_preview failed", error.code);
      lookupFailed = true;
    } else {
      invitation = ((data ?? []) as InvitationPreview[])[0] ?? null;
    }
  }

  const invalidLink = sp.error === "invalid";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Your Handson invitation"
        lead="Review the employer workspace invitation before you continue."
      />
      <Panel>
        {invalidLink && <Alert tone="danger"><T>{"This invitation link is not valid. Open the original email link or contact the Handson team."}</T></Alert>}

        {!tokenHash && !invalidLink && (
          <div className="flex flex-col gap-4">
            <Alert tone="warning"><T>{"We could not find an invitation in this browser. Open the link from the invitation email on this device."}</T></Alert>
            <p className="text-sm text-ink-muted"><T>{"For help, contact"}</T>{" "}<a href="mailto:hello@handson.cloud" className="font-semibold text-indigo hover:underline"><T>{"hello@handson.cloud"}</T></a>.</p>
          </div>
        )}

        {lookupFailed && <Alert tone="danger"><T>{"The invitation could not be checked. Please refresh the page or try again later."}</T></Alert>}

        {tokenHash && !lookupFailed && !invitation && (
          <Alert tone="danger"><T>{"This invitation could not be found. It may have been replaced, revoked or removed."}</T></Alert>
        )}

        {invitation && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-sm text-ink-muted"><T>{"You're invited to join"}</T></p>
              <h2 className="mt-1 text-2xl font-semibold">{invitation.company_name}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="indigo">{roleLabel[invitation.role]}</Badge>
                <Badge tone={invitation.status === "pending" ? "success" : invitation.status === "accepted" ? "neutral" : "warning"}>
                  {invitation.status === "pending" ? "Pending" : invitation.status === "accepted" ? "Already accepted" : invitation.status === "revoked" ? "Withdrawn" : "Expired"}
                </Badge>
              </div>
            </div>
            <div className="rounded-[14px] bg-surface p-4">
              <p className="text-sm text-ink-muted"><T>{"Invitation sent to"}</T></p>
              <p className="mt-1 font-semibold">{invitation.email_hint}</p>
              <p className="mt-2 text-sm text-ink-muted"><T>{"Expires"}</T>{" "}{expiryDate(invitation.expires_at)}</p>
            </div>

            {invitation.status === "pending" && user && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-ink-muted">
                  <T>{"Signed in as"}</T>{" "}<strong className="text-ink">{user.email}</strong><T>{". Make sure this is the account for the invited email address."}</T>
                </p>
                <AcceptCompanyInvitationForm />
                <form action={signOutForInvitation}>
                  <Button type="submit" variant="ghost"><T>{"Sign out and use another account"}</T></Button>
                </form>
              </div>
            )}

            {invitation.status === "pending" && !user && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-ink-muted">
                  <T>{"Create a Handson account or log in with the email address this invitation was sent to. You can use Google or email and password."}</T>
                </p>
                <div className="flex flex-wrap gap-3">
                  <ButtonLink href="/register?next=%2Finvite"><T>{"Create account"}</T></ButtonLink>
                  <ButtonLink href="/login?next=%2Finvite" variant="secondary"><T>{"Log in"}</T></ButtonLink>
                </div>
              </div>
            )}

            {invitation.status !== "pending" && (
              <div className="flex flex-col gap-3">
                <Alert tone={invitation.status === "accepted" ? "success" : "warning"}>
                  {invitation.status === "accepted"
                    ? "This invitation has already been accepted."
                    : invitation.status === "revoked"
                      ? "The company has withdrawn this invitation. This link can no longer be used."
                      : "This invitation has expired. Contact the Handson team to request a new invitation."}
                </Alert>
                {invitation.status === "accepted" && user && (
                  <ButtonLink href="/workspaces"><T>{"Open your workspaces"}</T></ButtonLink>
                )}
              </div>
            )}
          </div>
        )}
      </Panel>
      <p className="mt-6 text-center text-sm text-ink-muted">
        <T>{"Need help?"}</T>{" "}<Link href="mailto:hello@handson.cloud" className="font-semibold text-indigo hover:underline"><T>{"Contact Handson"}</T></Link>.
      </p>
    </div>
  );
}
