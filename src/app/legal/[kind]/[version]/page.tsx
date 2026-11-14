import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalDocumentView } from "@/components/legal/document-view";
import { getPublishedLegalDocument } from "@/lib/data/legal";
import { LEGAL_LABELS, isLegalKind } from "@/lib/legal";

export const metadata: Metadata = { title: "Legal document" };

/** A specific published version (current or earlier). Drafts are never shown here. */
export default async function LegalVersionPage({ params }: PageProps<"/legal/[kind]/[version]">) {
  const { kind, version } = await params;
  if (!isLegalKind(kind)) notFound();
  const doc = await getPublishedLegalDocument(kind, decodeURIComponent(version));
  if (!doc) notFound();
  return (
    <>
      <p className="mb-6 text-sm">
        <Link href={`/legal/${kind}`} className="font-semibold text-indigo hover:underline">
          Current {LEGAL_LABELS[kind]}
        </Link>
      </p>
      <LegalDocumentView title={doc.title} version={doc.version} effectiveAt={doc.effective_at} body={doc.body} />
    </>
  );
}
