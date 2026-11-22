import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { CV_HEADINGS, type CvData, type CvLocale } from "./model";

/**
 * Renders a one-column A4 CV with the built-in Helvetica fonts, so no font
 * files are bundled. Helvetica covers Portuguese (á, ã, ç, õ…); any character
 * it cannot draw is replaced, never dropped silently into a broken file.
 */

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 54;
const WIDTH = A4[0] - MARGIN * 2;

const INK = rgb(0x16 / 255, 0x13 / 255, 0x1f / 255);
const MUTED = rgb(0x5b / 255, 0x57 / 255, 0x66 / 255);
const ACCENT = rgb(0x3a / 255, 0x2b / 255, 0xd6 / 255);
const LINE = rgb(0xe4 / 255, 0xe0 / 255, 0xd6 / 255);

type Fonts = { regular: PDFFont; bold: PDFFont };

/** Replace characters the font cannot encode (emoji, other scripts) with a plain equivalent or "?". */
export function sanitise(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  const normalised = text
    .replace(/\r\n?/g, "\n")
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/\t/g, " ");
  let out = "";
  for (const ch of normalised) {
    const code = ch.codePointAt(0)!;
    if (ch === "\n" || supported.has(code)) {
      out += ch;
      continue;
    }
    const stripped = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    out += stripped && [...stripped].every((c) => supported.has(c.codePointAt(0)!)) ? stripped : "?";
  }
  return out;
}

/** Split text into lines that fit the width. Long words are broken. */
export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/ +/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (let word of words) {
      while (font.widthOfTextAtSize(word, size) > width) {
        let cut = word.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > width) cut--;
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

class Writer {
  page: PDFPage;
  y: number;

  constructor(
    private doc: PDFDocument,
    private fonts: Fonts,
  ) {
    this.page = doc.addPage(A4);
    this.y = A4[1] - MARGIN;
  }

  ensure(height: number) {
    if (this.y - height < MARGIN) {
      this.page = this.doc.addPage(A4);
      this.y = A4[1] - MARGIN;
    }
  }

  text(
    raw: string,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number; indent?: number; width?: number } = {},
  ) {
    const size = opts.size ?? 10.5;
    const font = opts.bold ? this.fonts.bold : this.fonts.regular;
    const leading = size * 1.35;
    const indent = opts.indent ?? 0;
    for (const line of wrap(sanitise(raw, font), font, size, (opts.width ?? WIDTH) - indent)) {
      this.ensure(leading);
      this.page.drawText(line, { x: MARGIN + indent, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= leading;
    }
    this.y -= opts.gap ?? 0;
  }

  /** Title on the left, period right-aligned on the same line. */
  titleRow(title: string, right: string | null) {
    const size = 11;
    const rightText = right ? sanitise(right, this.fonts.regular) : "";
    const rightWidth = rightText ? this.fonts.regular.widthOfTextAtSize(rightText, 9.5) + 12 : 0;
    this.ensure(size * 1.4);
    const top = this.y;
    this.text(title, { size, bold: true, width: WIDTH - rightWidth });
    if (rightText) {
      this.page.drawText(rightText, {
        x: MARGIN + WIDTH - (rightWidth - 12),
        y: top - size,
        size: 9.5,
        font: this.fonts.regular,
        color: MUTED,
      });
    }
  }

  heading(label: string) {
    this.ensure(40);
    this.y -= 14;
    this.page.drawText(sanitise(label.toUpperCase(), this.fonts.bold), {
      x: MARGIN,
      y: this.y - 10,
      size: 10,
      font: this.fonts.bold,
      color: ACCENT,
    });
    this.y -= 16;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + WIDTH, y: this.y }, thickness: 0.8, color: LINE });
    this.y -= 10;
  }
}

export async function renderCvPdf(cv: CvData, locale: CvLocale): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const h = CV_HEADINGS[locale];
  doc.setTitle(`CV – ${sanitise(cv.name, fonts.regular)}`);
  doc.setAuthor(sanitise(cv.name, fonts.regular));
  doc.setCreator("Handson · handson.cloud");
  doc.setProducer("Handson");
  doc.setLanguage(locale === "pt" ? "pt-MZ" : "en");

  const w = new Writer(doc, fonts);

  w.text(cv.name || " ", { size: 22, bold: true, gap: 2 });
  if (cv.headline) w.text(cv.headline, { size: 12, color: ACCENT, gap: 4 });
  if (cv.contact.length) w.text(cv.contact.join("  ·  "), { size: 9.5, color: MUTED, gap: 2 });

  if (cv.summary) {
    w.heading(h.profile);
    w.text(cv.summary);
  }

  for (const [label, entries] of [
    [h.education, cv.education],
    [h.experience, cv.experience],
    [h.training, cv.training ?? []],
  ] as const) {
    if (entries.length === 0) continue;
    w.heading(label);
    entries.forEach((e, i) => {
      w.titleRow(e.title, e.period);
      if (e.subtitle) w.text(e.subtitle, { size: 10, color: MUTED });
      if (e.body) w.text(e.body, { size: 10, gap: 0 });
      if (i < entries.length - 1) w.y -= 8;
    });
  }

  if (cv.skills.length) {
    w.heading(h.skills);
    w.text(cv.skills.join("  ·  "));
  }
  if (cv.languages.length) {
    w.heading(h.languages);
    w.text(cv.languages.join("  ·  "));
  }

  return doc.save();
}
