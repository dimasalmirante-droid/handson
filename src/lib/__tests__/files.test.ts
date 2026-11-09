import { describe, expect, it } from "vitest";
import { checkFileMeta, cleanFileName, contentMatches, formatFor, sniffFormat } from "../files";

const bytes = (...b: number[]) => {
  const out = new Uint8Array(32);
  out.set(b);
  return out;
};
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04);
const DOC = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
const EXE = bytes(0x4d, 0x5a, 0x90, 0x00); // Windows executable

describe("content sniffing", () => {
  it("recognises allowed formats by their first bytes", () => {
    expect(sniffFormat(PDF)).toBe("pdf");
    expect(sniffFormat(PNG)).toBe("png");
    expect(sniffFormat(JPG)).toBe("jpeg");
    expect(sniffFormat(ZIP)).toBe("zip");
    expect(sniffFormat(DOC)).toBe("doc");
    expect(sniffFormat(WEBP)).toBe("webp");
    expect(sniffFormat(EXE)).toBeNull();
  });

  it("rejects a renamed file whose content does not match", () => {
    expect(contentMatches("pdf", PDF)).toBe(true);
    expect(contentMatches("pdf", EXE)).toBe(false);
    expect(contentMatches("pdf", PNG)).toBe(false);
    expect(contentMatches("docx", ZIP)).toBe(true);
    expect(contentMatches("docx", PDF)).toBe(false);
  });
});

describe("file name, type and size", () => {
  it("accepts allowed documents", () => {
    expect(checkFileMeta("document", { name: "CV Amina.pdf", size: 200_000, type: "application/pdf" })).toBeNull();
    expect(checkFileMeta("document", { name: "Certificado.JPG", size: 900_000, type: "image/jpeg" })).toBeNull();
  });

  it("rejects disallowed extensions and mismatched declared types", () => {
    expect(checkFileMeta("document", { name: "virus.exe", size: 100, type: "application/octet-stream" })).toMatch(/not accepted/);
    expect(checkFileMeta("document", { name: "cv.pdf", size: 100, type: "image/png" })).toMatch(/not accepted/);
    expect(checkFileMeta("avatar", { name: "me.pdf", size: 100, type: "application/pdf" })).toMatch(/not accepted/);
  });

  it("enforces size limits per kind", () => {
    expect(checkFileMeta("document", { name: "big.pdf", size: 11 * 1024 * 1024, type: "application/pdf" })).toMatch(/too large/);
    expect(checkFileMeta("avatar", { name: "me.png", size: 3 * 1024 * 1024, type: "image/png" })).toMatch(/too large/);
    expect(checkFileMeta("document", { name: "empty.pdf", size: 0, type: "application/pdf" })).toMatch(/empty/);
  });

  it("tolerates a missing browser type and relies on the content check", () => {
    expect(formatFor("document", "cv.docx", "")).toBe("docx");
  });

  it("cleans unsafe characters from display names", () => {
    expect(cleanFileName('../../etc/pass<wd>.pdf')).toBe("....etcpasswd.pdf");
    expect(cleanFileName("   ")).toBe("document");
  });
});
