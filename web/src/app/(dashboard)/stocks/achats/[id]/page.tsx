import { PurchaseOrderDetailView } from "@/components/inventory/PurchaseOrderDetailView";

/**
 * Purchase order detail route. In Next 16 `params` is a Promise; we await it in
 * this server component and hand the id to the client view that owns the data
 * fetching, workflow actions and reception dialog.
 */
export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PurchaseOrderDetailView poId={Number(id)} />;
}
