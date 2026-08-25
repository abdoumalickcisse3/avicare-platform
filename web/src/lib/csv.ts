/**
 * Minimal CSV builder for client-side exports.
 *
 * Separator is `;`, not `,`: Excel in a French locale splits on the list separator, and a comma
 * file opens as one column per row. Decimal commas in French numbers would break a comma file too.
 */
const SEPARATOR = ";";

/** Quote a cell only when it needs it, doubling any embedded quote (RFC 4180). */
function cell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const text = String(value);
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
