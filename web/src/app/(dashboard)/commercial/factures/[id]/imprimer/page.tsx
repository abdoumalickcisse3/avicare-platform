import { InvoicePdfView } from "@/components/commercial/InvoicePdfView";

/**
 * Invoice PDF route. In Next 16 `params` is a Promise; we await it in this
 * server component and pass the id to the client view, which generates a real
 * PDF (react-pdf) — no browser print headers/footers, no app chrome.
 *
 * Opened in a new tab from InvoiceDetailView → "Imprimer / PDF".
 */
export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InvoicePdfView invoiceId={Number(id)} />;
}
