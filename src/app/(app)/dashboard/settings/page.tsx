import type { Metadata } from "next";
import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { PageHeader, Panel } from "@/components/dashboard/page-header";
import { PublicProfileForm } from "@/components/dashboard/public-profile-form";
import { EmailForm, PasswordForm, VisibilityToggle } from "@/components/dashboard/settings-forms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/feedback";
import { requestOrigin } from "@/lib/auth/origin";
import { requireStudent } from "@/lib/auth/session";
import { getConsentHistory, getProfile } from "@/lib/data/student";
import { site } from "@/lib/site";
import { suggestSlug } from "@/lib/validation/profile";
import { T } from "@/i18n/client";
import { getT } from "@/i18n/server";
import { getLocale } from "@/i18n/server";
import { LOCALE_TAGS, type Locale } from "@/i18n/config";
import { LanguagePreference } from "@/components/dashboard/language-preference";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Settings") };
}

const CONSENT_LABELS: Record<string, string> = {
  terms: "Terms and Conditions",
  privacy: "Privacy Policy",
  employer_visibility: "Employer visibility",
  public_profile: "Public profile link",
  marketing: "Marketing messages",
};

const dateTime = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleString(LOCALE_TAGS[locale], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Maputo" });

export default async function SettingsPage({ searchParams }: PageProps<"/dashboard/settings">) {
  const user = await requireStudent("/dashboard/settings");
  const [profile, history, sp, origin] = await Promise.all([getProfile(user.id), getConsentHistory(user.id), searchParams, requestOrigin()]);
  const usesPassword = user.provider === "email";
  const locale = await getLocale();

  return (
    <>
      <PageHeader title="Settings" lead="Privacy, account and security." />
      {sp.notice === "verified" && (
        <div className="mb-6 rounded-[14px] bg-success-soft px-4 py-3 text-[15px]"><T>{"Your new email address is confirmed."}</T></div>
      )}

      <div className="flex flex-col gap-6">
        <Panel title="Privacy" id="privacy">
          <VisibilityToggle initial={profile?.employer_visibility ?? false} />

          <details className="mt-6 rounded-[12px] bg-surface px-4 py-3">
            <summary className="cursor-pointer text-[15px] font-semibold"><T>{"Consent history"}</T></summary>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted"><T>{"No consent records yet."}</T></p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {history.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <T>{CONSENT_LABELS[c.consent_type] ?? c.consent_type}</T>{" "}
                      {c.action === "accepted" ? (
                        <Badge tone="success"><T>{"Accepted"}</T></Badge>
                      ) : c.action === "acknowledged" ? (
                        <Badge tone="success"><T>{"Acknowledged"}</T></Badge>
                      ) : c.granted ? (
                        <Badge tone="success"><T>{"Agreed"}</T></Badge>
                      ) : (
                        <Badge><T>{"Withdrawn"}</T></Badge>
                      )}
                    </span>
                    <span className="text-ink-muted">{dateTime(c.created_at, locale)} · <T>{"version"}</T> {c.version}</span>
                  </li>
                ))}
              </ul>
            )}
          </details>
          <p className="mt-4 text-sm text-ink-muted">
            <T>{"Read how we handle your information in our"}</T>{" "}
            <a href={site.links.privacy} className="font-semibold text-indigo hover:underline"><T>{"Privacy Policy"}</T></a>.
          </p>
        </Panel>

        <Panel title="Public profile" id="public-profile">
          <PublicProfileForm
            initial={{
              enabled: profile?.public_profile_enabled ?? false,
              slug: profile?.public_slug ?? null,
              sections: profile?.public_sections ?? [],
            }}
            suggestedSlug={suggestSlug(profile?.first_name, profile?.surname)}
            baseUrl={origin}
          />
        </Panel>

        <Panel title="Language">
          <LanguagePreference current={locale} />
        </Panel>

        <Panel title="Email address">
          {usesPassword ? (
            <EmailForm current={user.email} />
          ) : (
            <p className="text-[15px]">
              <T>{"You sign in with Google as"}</T>{" "}<strong>{user.email}</strong><T>{". To use a different email, sign in with that Google account instead."}</T>
            </p>
          )}
        </Panel>

        <Panel title="Password">
          {usesPassword ? (
            <PasswordForm />
          ) : (
            <p className="text-[15px] text-ink-muted">
              <T>{"You sign in with Google, so there is no Handson password to change. Manage your password in your Google account."}</T>
            </p>
          )}
        </Panel>

        <Panel title="Account">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[15px] text-ink-muted">
              <T>{"To delete your account and all your data, contact"}</T>{" "}
              <a href={`mailto:${site.contact.email}?subject=Delete my Handson account`} className="font-semibold text-indigo hover:underline">
                {site.contact.email}
              </a>{" "}
              <T>{"from your registered email."}</T>
            </p>
            <form action={signOutAction}>
              <Button type="submit" variant="secondary"><T>{"Sign out"}</T></Button>
            </form>
          </div>
          <p className="mt-4 text-sm text-ink-muted">
            <T>{"Need help?"}</T>{" "}<Link href={site.links.contact} className="font-semibold text-indigo hover:underline"><T>{"Contact us"}</T></Link>.
          </p>
        </Panel>
      </div>
    </>
  );
}
