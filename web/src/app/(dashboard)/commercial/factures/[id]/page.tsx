import { InvoiceDetailView } from "@/components/commercial/InvoiceDetailView";

/**
 * Invoice detail route. In Next 16 `params` is a Promise; we await it in this
 * server component and hand the id to the client view (amounts, lines, payments
 * and the record-payment / cancel actions).
 */
export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InvoiceDetailView invoiceId={Number(id)} />;
}
