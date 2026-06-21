import { PrintableDeliveryNote } from "@/components/commercial/PrintableDeliveryNote";

/**
 * Printable delivery note route. In Next 16 `params` is a Promise; we await it in
 * this server component and pass the id to the client component, which triggers
 * window.print() once the data has loaded.
 *
 * Open in a new tab from OrderDetailView → "Bon de livraison (PDF)".
 * The user then selects "Enregistrer en PDF" from the browser print dialog.
 */
export default async function DeliveryNotePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PrintableDeliveryNote deliveryId={Number(id)} />;
}
