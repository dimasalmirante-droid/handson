import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalDocumentView } from "@/components/legal/document-view";
import { Alert } from "@/components/ui/feedback";
import { getCurrentLegalDocuments, getLegalHistory, getPublishedLegalDocument } from "@/lib/data/legal";
import { LEGAL_LABELS, formatDate, isLegalKind } from "@/lib/legal";
import { site } from "@/lib/site";
import { T } from "@/i18n/client";
import { getT } from "@/i18n/server";

export async function generateMetadata({ params }: PageProps<"/legal/[kind]">): Promise<Metadata> {
  const { kind } = await params;
  const t = await getT();
  return { title: t(isLegalKind(kind) ? LEGAL_LABELS[kind] : "Not found") };
}

/** The current version of the Terms or the Privacy Notice, readable without signing in. */
export default async function CurrentLegalDocumentPage({ params }: PageProps<"/legal/[kind]">) {
  const { kind } = await params;
  if (!isLegalKind(kind)) notFound();
  const current = (await getCurrentLegalDocuments())[kind];
  const doc = current ? await getPublishedLegalDocument(kind, current.version) : null;

  if (!doc) {
    return (
      <div>
        <h1 className="text-[clamp(28px,4vw,40px)] tracking-[-0.03em]"><T>{LEGAL_LABELS[kind]}</T></h1>
        <Alert tone="info" className="mt-6">
          <T>{"The final version is being prepared. Until it is published, see the draft on"}</T>{" "}
          <a href={kind === "terms" ? site.links.terms : site.links.privacy} className="font-semibold text-indigo hover:underline">
            <T>{"handson.cloud"}</T>
          </a>
          .
        </Alert>
      </div>
    );
  }

  const history = (await getLegalHistory(kind)).filter((h) => h.id !== doc.id);
  return (
    <>
      <LegalDocumentView title={doc.title} version={doc.version} effectiveAt={doc.effective_at} body={doc.body} />
      {history.length > 0 && (
        <section className="mt-12 border-t border-line pt-6">
          <h2 className="text-lg"><T>{"Earlier versions"}</T></h2>
          <ul className="mt-3 flex flex-col gap-2 text-[15px]">
            {history.map((h) => (
              <li key={h.id}>
                <Link href={`/legal/${kind}/${encodeURIComponent(h.version)}`} className="font-semibold text-indigo hover:underline">
                  <T>{"Version"}</T>{" "}{h.version}
                </Link>{" "}
                <span className="text-ink-muted"><T>{"· effective"}</T>{" "}{formatDate(h.effective_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
