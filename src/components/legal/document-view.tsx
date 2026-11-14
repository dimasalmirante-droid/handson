import { formatDate, legalBlocks } from "@/lib/legal";

/** A legal document's text, rendered as plain text with headings (never as HTML). */
export function LegalDocumentView({
  title,
  version,
  effectiveAt,
  body,
}: {
  title: string;
  version: string;
  effectiveAt: string;
  body: string;
}) {
  return (
    <article className="min-w-0">
      <h1 className="text-[clamp(28px,4vw,40px)] tracking-[-0.03em]">{title}</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Version {version} · Effective {formatDate(effectiveAt)}
      </p>
      <div className="mt-8 flex flex-col gap-4 text-[16px] leading-relaxed">
        {legalBlocks(body).map((b, i) =>
          b.type === "h2" ? (
            <h2 key={i} className="mt-4 text-2xl">{b.text}</h2>
          ) : b.type === "h3" ? (
            <h3 key={i} className="mt-2 text-lg font-semibold">{b.text}</h3>
          ) : (
            <p key={i} className="whitespace-pre-line break-words">{b.text}</p>
          ),
        )}
      </div>
    </article>
  );
}
