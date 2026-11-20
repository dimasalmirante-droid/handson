import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/forms";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Choose a new password") };
}

/** Reached from the password-reset email link, which signs the user in for this purpose. */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?error=link");
  const t = await getT();

  return (
    <div>
      <h1 className="text-[36px] tracking-[-0.03em]">{t("Choose a new password")}</h1>
      <p className="mt-2 text-ink-muted">{t("For")} {data.user.email}</p>
      <div className="mt-6">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
