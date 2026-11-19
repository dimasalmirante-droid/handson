import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { cvFileName, cvGaps, monthYear, period, type CvData } from "../cv/model";
import { renderCvPdf, sanitise, wrap } from "../cv/pdf";

const sample: CvData = {
  name: "Amina Macuácua",
  headline: "Finalista de Contabilidade e Auditoria à procura de estágio",
  contact: ["amina@example.com", "+258 84 123 4567", "KaMpfumo, Cidade de Maputo"],
  summary: "Estudante organizada, com experiência em folhas de cálculo e atendimento ao público.",
  education: [
    { title: "Licenciatura em Contabilidade", subtitle: "Universidade Eduardo Mondlane", period: "2022 – presente", body: "Em curso · 4.º ano" },
  ],
  experience: [
    { title: "Estagiária de contabilidade", subtitle: "Empresa X · Estágio · Maputo", period: "jan 2025 – mar 2025", body: "Reconciliação bancária." },
  ],
  skills: ["Excel (avançado)", "Atendimento ao cliente (intermédio)"],
  languages: ["Português (nativo)", "Inglês (intermédio)", "Xichangana (fluente)"],
};

describe("CV model", () => {
  it("formats months and periods in both languages", () => {
    expect(monthYear("2024-03-01", "pt")).toBe("mar 2024");
    expect(monthYear("2024-03-01", "en")).toBe("Mar 2024");
    expect(period("2022", null, true, "pt")).toBe("2022 – presente");
    expect(period("2022", "2022", false, "en")).toBe("2022");
    expect(period(null, null, false, "pt")).toBeNull();
  });

  it("lists what is missing before the CV is useful", () => {
    expect(cvGaps(sample)).toEqual([]);
    expect(cvGaps({ ...sample, headline: null, experience: [], skills: [] })).toEqual(["headline", "experience", "skills"]);
  });

  it("builds a safe file name", () => {
    expect(cvFileName("Amina Macuácua")).toBe("CV-Amina-Macuacua.pdf");
    expect(cvFileName("  ")).toBe("CV-Handson.pdf");
    expect(cvFileName('a"b/c')).toBe("CV-a-b-c.pdf");
  });
});

describe("CV PDF", () => {
  it("renders a valid PDF with Portuguese characters", async () => {
    const bytes = await renderCvPdf(sample, "pt");
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("CV – Amina Macuácua");
  });

  it("replaces characters the font cannot draw instead of failing", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    expect(sanitise("Olá 👋 São Tomé ✓ şehir", font)).toBe("Olá ? São Tomé ? sehir");
    await expect(renderCvPdf({ ...sample, summary: "Emoji 🚀 e 中文" }, "pt")).resolves.toBeInstanceOf(Uint8Array);
  });

  it("wraps long text, breaks very long words and adds pages when needed", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrap(`${"palavra ".repeat(40)}\n${"x".repeat(200)}`, font, 10, 200);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(200);
    expect(lines.length).toBeGreaterThan(5);

    const long = { ...sample, experience: Array.from({ length: 30 }, () => sample.experience[0]) };
    const pdf = await PDFDocument.load(await renderCvPdf(long, "en"));
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });

  it("renders an empty profile without failing", async () => {
    const empty: CvData = { name: "", headline: null, contact: [], summary: null, education: [], experience: [], skills: [], languages: [] };
    const pdf = await PDFDocument.load(await renderCvPdf(empty, "pt"));
    expect(pdf.getPageCount()).toBe(1);
  });
});
