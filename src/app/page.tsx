import { AppFooter, AppHeader } from "@/components/layout/site-chrome";
import { ButtonLink } from "@/components/ui/button";
import { getMessages } from "@/i18n/get-messages";
import { site } from "@/lib/site";

export default async function StartPage() {
  const t = await getMessages();

  return (
    <>
      <AppHeader>
        <a href={site.publicUrl} className="hidden text-sm font-medium text-ink-muted hover:text-indigo sm:inline">
          {t.common.backToSite}
        </a>
      </AppHeader>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
        <h1 className="text-[clamp(36px,6vw,56px)] tracking-[-0.03em]">{t.home.title}</h1>
        <p className="mt-5 max-w-xl text-lg text-ink-muted">{t.home.lead}</p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <ButtonLink href="/register" size="lg">
            {t.home.createProfile}
          </ButtonLink>
          <ButtonLink href="/login" size="lg" variant="secondary">
            {t.home.logIn}
          </ButtonLink>
        </div>
      </main>
      <AppFooter />
    </>
  );
}
