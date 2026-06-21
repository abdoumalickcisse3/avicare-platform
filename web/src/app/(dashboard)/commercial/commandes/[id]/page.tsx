import { OrderDetailView } from "@/components/commercial/OrderDetailView";

/**
 * Order detail route. In Next 16 `params` is a Promise; we await it in this server
 * component and hand the id to the client view that owns the data fetching, the
 * status stepper and the workflow actions.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderDetailView orderId={Number(id)} />;
}
