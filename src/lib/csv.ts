/**
 * CSV helpers. Cells that a spreadsheet would treat as a formula (starting
 * with = + - @ or a control character) are prefixed with an apostrophe to
 * prevent formula injection when the export is opened in Excel.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  // UTF-8 BOM so Excel shows Portuguese accents correctly.
  return "﻿" + [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
