import type { Metadata } from "next";
import Link from "next/link";
import { Divider, GoogleForm, LoginForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/feedback";
import { safeNextPath } from "@/lib/auth/redirects";

export const metadata: Metadata = { title: "Log in" };

const errors: Record<string, string> = {
  google: "Google sign-in could not be completed. Please try again or use your email and password.",
  link: "That link is invalid or has expired. Log in, or request a new link.",
  suspended: "Your account has been suspended. If you think this is a mistake, contact hello@handson.cloud.",
};

const notices: Record<string, string> = {
  "signed-out": "You have signed out.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? errors[sp.error] : undefined;
  const notice = typeof sp.notice === "string" ? notices[sp.notice] : undefined;
  const nextParam = typeof sp.next === "string" ? sp.next : undefined;
  const next = nextParam ? safeNextPath(nextParam, "") || undefined : undefined;

  return (
    <div>
      <h1 className="text-[36px] tracking-[-0.03em]">Welcome back</h1>
      <p className="mt-2 text-ink-muted">Log in to continue building your profile.</p>

      <div className="mt-6 flex flex-col gap-5">
        {error && <Alert tone="danger">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
        <GoogleForm label="Continue with Google" next={next} />
        <Divider label="or" />
        <LoginForm next={next} />
      </div>

      <p className="mt-8 text-[15px] text-ink-muted">
        New to Handson?{" "}
        <Link href="/register" className="font-semibold text-indigo hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
