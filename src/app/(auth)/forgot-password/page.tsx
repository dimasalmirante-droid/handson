import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-[36px] tracking-[-0.03em]">Reset your password</h1>
      <p className="mt-2 text-ink-muted">Enter the email address for your account and we will send you a reset link.</p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-8 text-[15px] text-ink-muted">
        <Link href="/login" className="font-semibold text-indigo hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
