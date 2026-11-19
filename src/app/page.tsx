import { AppFooter, AppHeader } from "@/components/layout/site-chrome";
import { ButtonLink } from "@/components/ui/button";
import { getT } from "@/i18n/server";
import { site } from "@/lib/site";

export default async function StartPage() {
  const t = await getT();

  return (
    <>
      <AppHeader>
        <a href={site.publicUrl} className="hidden text-sm font-medium text-ink-muted hover:text-indigo sm:inline">
          {t("Back to handson.cloud")}
        </a>
      </AppHeader>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
        <h1 className="text-[clamp(36px,6vw,56px)] tracking-[-0.03em]">{t("Your early-career profile, in one place")}</h1>
        <p className="mt-5 max-w-xl text-lg text-ink-muted">{t("Create your Handson account to build your professional profile, upload your documents and control who can see them.")}</p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <ButtonLink href="/register" size="lg">
            {t("Create your profile")}
          </ButtonLink>
          <ButtonLink href="/login" size="lg" variant="secondary">
            {t("Log in")}
          </ButtonLink>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
