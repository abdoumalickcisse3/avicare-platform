import { LayerUnitDetailView } from "@/components/poultry-layer/LayerUnitDetailView";

/**
 * Layer (ponte) unit detail route. In Next 16 `params` is a Promise; we await it
 * in this server component and hand the id to the client view that owns the data
 * fetching and tab state.
 */
export default async function LayerUnitDetailPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;
  return <LayerUnitDetailView unitId={Number(unitId)} />;
}
