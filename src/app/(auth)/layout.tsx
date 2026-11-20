import { Suspense, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { AppFooter } from "@/components/layout/site-chrome";
import { getT } from "@/i18n/server";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

/** Split layout for sign-in and sign-up: brand panel (desktop) + form. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getT();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <aside className="relative hidden overflow-hidden bg-indigo p-12 text-white lg:flex lg:flex-col">
          <Wordmark inverse />
          <div className="relative z-10 mt-auto max-w-md">
            <p className="font-display text-[40px] font-bold leading-[1.05] tracking-[-0.03em]">
              {t("One profile for every opportunity ahead.")}
            </p>
            <p className="mt-4 text-[#E4E1FB]">
              {t("Education, skills, experience and documents in one place. Private until you decide otherwise.")}
            </p>
          </div>
          <div aria-hidden className="absolute -right-16 top-24 size-56 rounded-full bg-coral" />
          <div aria-hidden className="absolute right-24 top-72 h-28 w-44 rounded-[20px] bg-lime" />
        </aside>
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-4 pt-6 sm:px-8">
            <span className="lg:hidden"><Wordmark /></span>
            <Suspense>
              <LanguageSwitcher className="ml-auto" />
            </Suspense>
          </div>
          <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
            <div className="w-full max-w-[440px]">{children}</div>
          </main>
        </div>
      </div>
      <AppFooter />
    </div>
  );
}
