import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/feedback";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Verify your email") };
}

export default async function CheckEmailPage({ searchParams }: PageProps<"/check-email">) {
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email.slice(0, 254) : undefined;
  const t = await getT();

  return (
    <div>
      <h1 className="text-[36px] tracking-[-0.03em]">{t("Check your email")}</h1>
      <p className="mt-3 text-ink-muted">
        {t("We sent a verification link to")} {email ? <strong className="text-ink">{email}</strong> : t("your email address")}.{" "}
        {t("Open it to activate your account and start your profile.")}
      </p>
      <Alert tone="info" className="mt-6" title="Didn't receive it?">
        {t("Check your spam or promotions folder. The link expires after 24 hours. If you already have an account with this email, log in instead.")}
      </Alert>
      <p className="mt-8 text-[15px] text-ink-muted">
        <Link href="/login" className="font-semibold text-indigo hover:underline">
          {t("Back to log in")}
        </Link>
      </p>
    </div>
  );
}
