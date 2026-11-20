import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forms";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Reset your password") };
}

export default async function ForgotPasswordPage() {
  const t = await getT();
  return (
    <div>
      <h1 className="text-[36px] tracking-[-0.03em]">{t("Reset your password")}</h1>
      <p className="mt-2 text-ink-muted">{t("Enter the email address for your account and we will send you a reset link.")}</p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-8 text-[15px] text-ink-muted">
        <Link href="/login" className="font-semibold text-indigo hover:underline">
          {t("Back to log in")}
        </Link>
      </p>
    </div>
  );
}
