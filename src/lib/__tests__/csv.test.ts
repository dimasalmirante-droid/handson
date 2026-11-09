import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "../csv";

describe("CSV export", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("Maputo, Mozambique")).toBe('"Maputo, Mozambique"');
    expect(csvCell('Say "olá"')).toBe('"Say ""olá"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell("+258841234567")).toBe("'+258841234567");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });

  it("handles empty values and adds a BOM for Excel", () => {
    expect(csvCell(null)).toBe("");
    const out = toCsv(["Name", "Year"], [["Amina", 2027]]);
    expect(out.startsWith("﻿Name,Year\r\nAmina,2027")).toBe(true);
  });
});
