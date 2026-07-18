import type { CatalogEntry } from "@/store/api/catalogApi";

/**
 * Resolve a sales-channel key to its human label from the farm's `sales_channels`
 * catalog. Falls back to the raw key if the channel no longer exists (e.g. it was
 * removed after a sale was tagged), and returns `null` when there is no channel —
 * callers decide how to render "no channel" (a dash in a table, a hidden row in a
 * detail view).
 */
export function channelLabel(
  channels: CatalogEntry[] | undefined,
  key: string | null,
): string | null {
  if (!key) return null;
  const match = channels?.find((c) => c.key === key);
  return match ? String(match.value.label ?? key) : key;
}
