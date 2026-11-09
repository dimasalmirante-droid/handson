import type { Metadata } from "next";
import Link from "next/link";
import { Divider, GoogleForm, RegisterForm, type RegisterLegal } from "@/components/auth/forms";
import { safeNextPath } from "@/lib/auth/redirects";
import { getCurrentLegalDocuments } from "@/lib/data/legal";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const sp = await searchParams;
  const nextParam = typeof sp.next === "string" ? safeNextPath(sp.next, "") : "";
  const docs = await getCurrentLegalDocuments();
  const legal: RegisterLegal =
    docs.terms && docs.privacy
      ? {
          terms: { id: docs.terms.id, version: docs.terms.version, href: "/legal/terms" },
          privacy: { id: docs.privacy.id, version: docs.privacy.version, href: "/legal/privacy" },
        }
      : null;
  const termsHref = legal ? legal.terms.href : site.links.terms;
  const privacyHref = legal ? legal.privacy.href : site.links.privacy;

  return (
    <div>
      <h1 className="text-[36px] tracking-[-0.03em]">Create your account</h1>
      <p className="mt-2 text-ink-muted">
        Build one professional profile for internships, traineeships and first jobs. Your profile is private by default.
      </p>

      <div className="mt-6 flex flex-col gap-5">
        <GoogleForm label="Continue with Google" intent="student" next={nextParam || undefined} />
        {legal ? (
          <p className="-mt-2 text-center text-xs text-ink-muted">
            After signing in with Google you will be asked to accept the{" "}
            <a href={termsHref} className="underline hover:text-indigo">Terms and Conditions</a> and acknowledge the{" "}
            <a href={privacyHref} className="underline hover:text-indigo">Privacy Notice</a>.
          </p>
        ) : (
          <p className="-mt-2 text-center text-xs text-ink-muted">
            By continuing with Google you agree to the{" "}
            <a href={termsHref} className="underline hover:text-indigo">Terms and Conditions</a> and acknowledge the{" "}
            <a href={privacyHref} className="underline hover:text-indigo">Privacy Policy</a>.
          </p>
        )}
        <Divider label="or sign up with email" />
        <RegisterForm termsUrl={site.links.terms} privacyUrl={site.links.privacy} legal={legal} next={nextParam || undefined} />
      </div>

      <p className="mt-8 text-[15px] text-ink-muted">
        Already have an account?{" "}
        <Link href={nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : "/login"} className="font-semibold text-indigo hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
