import { Suspense, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { site } from "@/lib/site";
import { getT } from "@/i18n/server";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

/** Minimal header for public app pages (start page, auth). */
export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Wordmark />
        <div className="flex items-center gap-3">
          {children}
          <Suspense>
            <LanguageSwitcher />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

export async function AppFooter() {
  const t = await getT();
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© Handson · {t(site.contact.city)}</p>
        <nav aria-label={t("Legal")} className="flex flex-wrap gap-x-5 gap-y-2">
          <a className="hover:text-indigo" href={site.links.privacy}>{t("Privacy Policy")}</a>
          <a className="hover:text-indigo" href={site.links.terms}>{t("Terms and Conditions")}</a>
          <a className="hover:text-indigo" href={site.links.contact}>{t("Contact")}</a>
        </nav>
      </div>
    </footer>
  );
}
