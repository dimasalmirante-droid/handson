import type { ReactNode } from "react";

/**
 * Renders the small Markdown subset used in lesson text: paragraphs, "### "
 * headings, "- " bullet lists, "1. " numbered lists and **bold**. Everything
 * becomes React text nodes, so lesson content can never inject HTML.
 */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

type Block = { kind: "p" | "h" | "ul" | "ol"; lines: string[] };

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const last = blocks[blocks.length - 1];
    if (!line.trim()) {
      blocks.push({ kind: "p", lines: [] });
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) blocks.push({ kind: "h", lines: [heading[1]] });
    else if (bullet) {
      if (last?.kind === "ul") last.lines.push(bullet[1]);
      else blocks.push({ kind: "ul", lines: [bullet[1]] });
    } else if (numbered) {
      if (last?.kind === "ol") last.lines.push(numbered[1]);
      else blocks.push({ kind: "ol", lines: [numbered[1]] });
    } else if (last?.kind === "p" && last.lines.length) last.lines.push(line.trim());
    else blocks.push({ kind: "p", lines: [line.trim()] });
  }
  return blocks.filter((b) => b.lines.length > 0);
}

export function LessonBody({ source }: { source: string }) {
  return (
    <div className="flex flex-col gap-4 text-[16px] leading-relaxed">
      {parseBlocks(source).map((b, i) => {
        if (b.kind === "h") return <h3 key={i} className="mt-2 text-lg">{inline(b.lines[0])}</h3>;
        if (b.kind === "ul")
          return (
            <ul key={i} className="ml-5 list-disc space-y-1.5">
              {b.lines.map((l, j) => <li key={j}>{inline(l)}</li>)}
            </ul>
          );
        if (b.kind === "ol")
          return (
            <ol key={i} className="ml-5 list-decimal space-y-1.5">
              {b.lines.map((l, j) => <li key={j}>{inline(l)}</li>)}
            </ol>
          );
        return <p key={i}>{inline(b.lines.join(" "))}</p>;
      })}
    </div>
  );
}
