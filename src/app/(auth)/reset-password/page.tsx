import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/forms";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a new password" };

/** Reached from the password-reset email link, which signs the user in for this purpose. */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?error=link");

  return (
    <div>
      <h1 className="text-[36px] tracking-[-0.03em]">Choose a new password</h1>
      <p className="mt-2 text-ink-muted">For {data.user.email}</p>
      <div className="mt-6">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
