import type { Metadata } from "next";
import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Sign out") };
}

/** Public confirmation page. Signing out is always available and always ends on the login page. */
export default async function SignOutPage() {
  const t = await getT();
  return (
    <div>
      <h1 className="text-[36px] tracking-[-0.03em]">{t("Sign out of Handson?")}</h1>
      <p className="mt-2 text-ink-muted">{t("You can sign back in at any time.")}</p>
      <form action={signOutAction} className="mt-6">
        <Button type="submit" fullWidth>{t("Sign out")}</Button>
      </form>
      <p className="mt-6 text-[15px] text-ink-muted">
        <Link href="/start" className="font-semibold text-indigo hover:underline">{t("Stay signed in")}</Link>
      </p>
    </div>
  );
}
