import { PoultryBatchDetailView } from "@/components/poultry/PoultryBatchDetailView";

/**
 * Poultry batch detail route. In Next 16 `params` is a Promise; we await it in
 * this server component and hand the id to the client view that owns the data
 * fetching and tab state.
 */
export default async function PoultryBatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PoultryBatchDetailView batchId={Number(id)} />;
}
