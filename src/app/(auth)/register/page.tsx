import type { Metadata } from "next";
import Link from "next/link";
import { Divider, GoogleForm, RegisterForm } from "@/components/auth/forms";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Create your account" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-[36px] tracking-[-0.03em]">Create your account</h1>
      <p className="mt-2 text-ink-muted">
        Build one professional profile for internships, traineeships and first jobs. Your profile is private by default.
      </p>

      <div className="mt-6 flex flex-col gap-5">
        <GoogleForm label="Continue with Google" />
        <p className="-mt-2 text-center text-xs text-ink-muted">
          By continuing with Google you agree to the{" "}
          <a href={site.links.terms} className="underline hover:text-indigo">Terms and Conditions</a> and acknowledge the{" "}
          <a href={site.links.privacy} className="underline hover:text-indigo">Privacy Policy</a>.
        </p>
        <Divider label="or sign up with email" />
        <RegisterForm termsUrl={site.links.terms} privacyUrl={site.links.privacy} />
      </div>

      <p className="mt-8 text-[15px] text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-indigo hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
