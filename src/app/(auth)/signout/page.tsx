import type { Metadata } from "next";
import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sign out" };

/** Public confirmation page. Signing out is always available and always ends on the login page. */
export default function SignOutPage() {
  return (
    <div>
      <h1 className="text-[36px] tracking-[-0.03em]">Sign out of Handson?</h1>
      <p className="mt-2 text-ink-muted">You can sign back in at any time.</p>
      <form action={signOutAction} className="mt-6">
        <Button type="submit" fullWidth>Sign out</Button>
      </form>
      <p className="mt-6 text-[15px] text-ink-muted">
        <Link href="/start" className="font-semibold text-indigo hover:underline">Stay signed in</Link>
      </p>
    </div>
  );
}
