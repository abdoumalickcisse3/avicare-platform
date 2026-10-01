/**
 * Where a notification leads. Shared by the bell screen (a tap on a row) and the push handler (a
 * tap on a banner), so both land on the same screen for the same notification.
 */
export type SourceRef = Record<string, unknown> | null | undefined;

export const NOTIFICATIONS_HREF = '/(field)/notifications';

export function hrefFor(sourceRef: SourceRef): string | null {
  const ref = sourceRef ?? {};
  if (typeof ref.unitId === 'number') return `/(field)/lots/${ref.unitId}`;
  if (typeof ref.itemId === 'number' || typeof ref.purchaseOrderId === 'number')
    return '/(field)/(tabs)/stocks';
  if (typeof ref.invoiceId === 'number') return '/(field)/commerce/factures';
  if (typeof ref.clientId === 'number') return '/(field)/commerce/commandes';
  return null;
}

export interface PushTapTarget {
  notificationId: number | null;
  farmId: number | null;
  href: string;
}

const asId = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
};

/** Reads the `data` the backend attaches to a push; anything unreadable falls back to the bell. */
export function parsePushData(data: unknown): PushTapTarget {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const sourceRef =
    d.sourceRef && typeof d.sourceRef === 'object' ? (d.sourceRef as Record<string, unknown>) : null;
  return {
    notificationId: asId(d.notificationId),
    farmId: asId(d.farmId),
    href: hrefFor(sourceRef) ?? NOTIFICATIONS_HREF,
  };
}
