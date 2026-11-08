import { AppFooter, AppHeader } from "@/components/layout/site-chrome";
import { ButtonLink } from "@/components/ui/button";
import { getMessages } from "@/i18n/get-messages";

export default async function NotFound() {
  const t = await getMessages();
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <p className="font-display text-7xl font-bold text-indigo">404</p>
        <h1 className="mt-4 text-3xl">{t.notFound.title}</h1>
        <p className="mt-3 text-ink-muted">{t.notFound.lead}</p>
        <ButtonLink href="/" className="mt-8">
          {t.notFound.home}
        </ButtonLink>
      </main>
      <AppFooter />
    </>
  );
}
