import { FarmDetailView } from "@/components/farms/FarmDetailView";

/**
 * Farm detail route. In Next 16 `params` is a Promise; we await it in this
 * server component and hand the id to the client view that owns the data
 * fetching and tab state.
 */
export default async function FarmDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FarmDetailView farmId={Number(id)} />;
}
