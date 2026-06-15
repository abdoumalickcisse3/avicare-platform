import { StockItemDetailView } from "@/components/inventory/StockItemDetailView";

/**
 * Stock item detail route. In Next 16 `params` is a Promise; we await it in this
 * server component and hand the id to the client view that owns the data fetching,
 * the stock-evolution chart and the movements tabs.
 */
export default async function StockItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StockItemDetailView stockItemId={Number(id)} />;
}
