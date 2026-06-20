import { ClientDetailView } from "@/components/commercial/ClientDetailView";

/**
 * Client detail route. In Next 16 `params` is a Promise; we await it in this
 * server component and hand the id to the client view that owns the data
 * fetching, the credit summary and (later tranches) the orders/invoices tabs.
 */
export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClientDetailView clientId={Number(id)} />;
}
