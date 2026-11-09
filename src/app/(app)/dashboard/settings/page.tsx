import type { Metadata } from "next";
import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { EmailForm, PasswordForm, VisibilityToggle } from "@/components/dashboard/settings-forms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth/session";
import { getConsentHistory, getProfile } from "@/lib/data/student";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Settings" };

const CONSENT_LABELS: Record<string, string> = {
  terms: "Terms and Conditions",
  privacy: "Privacy Policy",
  employer_visibility: "Employer visibility",
  marketing: "Marketing messages",
};

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Maputo" });

export default async function SettingsPage({ searchParams }: PageProps<"/dashboard/settings">) {
  const user = await requireUser("/dashboard/settings");
  const [profile, history, sp] = await Promise.all([getProfile(user.id), getConsentHistory(user.id), searchParams]);
  const usesPassword = user.provider === "email";

  return (
    <>
      <PageHeader title="Settings" lead="Privacy, account and security." />
      {sp.notice === "verified" && (
        <div className="mb-6 rounded-[14px] bg-success-soft px-4 py-3 text-[15px]">Your new email address is confirmed.</div>
      )}

      <div className="flex flex-col gap-6">
        <Panel title="Privacy" id="privacy">
          <VisibilityToggle initial={profile?.employer_visibility ?? false} />

          <details className="mt-6 rounded-[12px] bg-surface px-4 py-3">
            <summary className="cursor-pointer text-[15px] font-semibold">Consent history</summary>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">No consent records yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {history.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {CONSENT_LABELS[c.consent_type] ?? c.consent_type}{" "}
                      {c.granted ? <Badge tone="success">Agreed</Badge> : <Badge>Withdrawn</Badge>}
                    </span>
                    <span className="text-ink-muted">{dateTime(c.created_at)} · version {c.version}</span>
                  </li>
                ))}
              </ul>
            )}
          </details>
          <p className="mt-4 text-sm text-ink-muted">
            Read how we handle your information in our{" "}
            <a href={site.links.privacy} className="font-semibold text-indigo hover:underline">Privacy Policy</a>.
          </p>
        </Panel>

        <Panel title="Email address">
          {usesPassword ? (
            <EmailForm current={user.email} />
          ) : (
            <p className="text-[15px]">
              You sign in with Google as <strong>{user.email}</strong>. To use a different email, sign in with that Google account instead.
            </p>
          )}
        </Panel>

        <Panel title="Password">
          {usesPassword ? (
            <PasswordForm />
          ) : (
            <p className="text-[15px] text-ink-muted">
              You sign in with Google, so there is no Handson password to change. Manage your password in your Google account.
            </p>
          )}
        </Panel>

        <Panel title="Account">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[15px] text-ink-muted">
              To delete your account and all your data, contact{" "}
              <a href={`mailto:${site.contact.email}?subject=Delete my Handson account`} className="font-semibold text-indigo hover:underline">
                {site.contact.email}
              </a>{" "}
              from your registered email.
            </p>
            <form action={signOutAction}>
              <Button type="submit" variant="secondary">Sign out</Button>
            </form>
          </div>
          <p className="mt-4 text-sm text-ink-muted">
            Need help? <Link href={site.links.contact} className="font-semibold text-indigo hover:underline">Contact us</Link>.
          </p>
        </Panel>
      </div>
    </>
  );
}
