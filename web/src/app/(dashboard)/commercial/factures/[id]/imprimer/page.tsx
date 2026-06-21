import { PrintableInvoice } from "@/components/commercial/PrintableInvoice";

/**
 * Printable invoice route. In Next 16 `params` is a Promise; we await it in this
 * server component and pass the id to the client component, which triggers
 * window.print() once the data has loaded.
 *
 * Open in a new tab from InvoiceDetailView → "Imprimer / PDF".
 * The user then selects "Enregistrer en PDF" from the browser print dialog.
 */
export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PrintableInvoice invoiceId={Number(id)} />;
}
