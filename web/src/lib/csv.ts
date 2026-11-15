/**
 * Minimal CSV builder for client-side exports.
 *
 * Separator is `;`, not `,`: Excel in a French locale splits on the list separator, and a comma
 * file opens as one column per row. Decimal commas in French numbers would break a comma file too.
 */
const SEPARATOR = ";";

/**
 * What a spreadsheet reads as the start of a formula rather than as text.
 *
 * Excel, LibreOffice and Google Sheets all evaluate a cell beginning with one of these, which is
 * how a line of exported data becomes code running on the machine that opened the file.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/** A number written as text — `-1500` is a figure, not a formula, and must stay a figure. */
const PLAIN_NUMBER = /^[-+]?\d+([.,]\d+)?$/;

/**
 * Neutralise a cell a spreadsheet would execute.
 *
 * Some of what we export is typed by strangers: the field survey is the one write path open to the
 * public internet, so a respondent can put `=HYPERLINK(…)` in the name of their feed supplier and
 * it is a staff member who opens the file. A leading apostrophe makes the spreadsheet treat the
 * rest as text; it is the standard mitigation and it is visible, which is the point — the reader
 * can see the value was quoted.
 *
 * Numbers are left alone, by type and by shape: prefixing `-1500` would turn every negative figure
 * in the finance exports into text no one can total.
 */
function defuse(value: string | number, text: string): string {
  if (typeof value === "number") return text;
  if (!FORMULA_TRIGGER.test(text)) return text;
  if (PLAIN_NUMBER.test(text)) return text;
  return `'${text}`;
}

/** Quote a cell only when it needs it, doubling any embedded quote (RFC 4180). */
function cell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const text = defuse(value, String(value));
  return /["\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Build a CSV document from a header row and its data rows. */
export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  return [headers, ...rows].map((r) => r.map(cell).join(SEPARATOR)).join("\r\n");
}

/**
 * Hand the browser a CSV file to save. Prefixed with a BOM so Excel reads it as UTF-8 — without it
 * accented French labels come out mangled.
 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
