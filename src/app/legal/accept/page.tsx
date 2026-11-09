import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/(auth)/actions";
import { AcceptLegalForm } from "@/components/legal/accept-form";
import { Button } from "@/components/ui/button";
import { getLegalStatus } from "@/lib/auth/contexts";
import { safeNextPath } from "@/lib/auth/redirects";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms and Privacy Notice" };

/**
 * One-time screen shown when the current Terms and/or Privacy Notice have
 * not yet been accepted by this account. Only appears once final versions of
 * both are published and in force; only lists the documents that need action.
 */
export default async function AcceptLegalPage({ searchParams }: PageProps<"/legal/accept">) {
  await requireUser("/legal/accept", { skipLegal: true });
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeNextPath(sp.next, "") : "";
  const status = await getLegalStatus();
  if (!status.active || status.required.length === 0) redirect(next || "/start");

  const updated = status.required.length === 1;
  return (
    <div>
      <h1 className="text-[clamp(28px,4vw,40px)] tracking-[-0.03em]">
        {updated ? "We have updated a document" : "Before you continue"}
      </h1>
      <p className="mt-2 text-ink-muted">
        {updated
          ? "Please review the updated version below to keep using Handson."
          : "Please review our Terms and Conditions and Privacy Notice to use Handson."}
      </p>
      <div className="mt-8">
        <AcceptLegalForm
          next={next || undefined}
          documents={status.required.map((d) => ({ ...d, effective: formatDate(d.effective_at) }))}
        />
      </div>
      <div className="mt-8 border-t border-line pt-6">
        <p className="mb-3 text-sm text-ink-muted">If you do not agree, you can sign out. Your account is kept.</p>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary">Sign out</Button>
        </form>
      </div>
    </div>
  );
}
