/**
 * Reading a stock ledger.
 *
 * The web renders movements as three dense tables of raw columns — `dailyRecordId`,
 * `vaccinationId`, `purchaseOrderId` — and leaves the reader to work out where a line came from.
 * On a phone there is room for one sentence per line, so that sentence has to be the answer.
 */
import type { MovementReason, StockMovement } from '@/types';

export const MOVEMENT_REASON_LABELS: Record<MovementReason, string> = {
  RECEPTION_PURCHASE: 'Réception',
  GIFT: 'Don reçu',
  RETURN_SUPPLIER: 'Retour fournisseur',
  CONSUMPTION_LOT: 'Consommé par un lot',
  CONSUMPTION_VACCINATION: 'Vaccination',
  CONSUMPTION_TREATMENT: 'Traitement',
  LOSS: 'Perte',
  SALE: 'Vente',
  THEFT: 'Vol',
  INVENTORY_PHYSICAL: 'Inventaire physique',
  ERROR_CORRECTION: 'Correction',
};

export function reasonLabel(reason: MovementReason): string {
  return MOVEMENT_REASON_LABELS[reason] ?? reason;
}

/**
 * Where a movement came from, in one phrase.
 *
 * The order matters: a movement can carry several origin ids at once (a treatment executed on a
 * flock has both `treatmentExecutedId` and `productionUnitId`), and the most specific one is the
 * one worth naming — "Traitement" tells the reader more than "Lot".
 */
export function movementOrigin(m: StockMovement): string {
  if (m.purchaseOrderId != null) return `Bon d'achat nº ${m.purchaseOrderId}`;
  if (m.treatmentExecutedId != null) return 'Traitement administré';
  if (m.vaccinationId != null) return 'Vaccination';
  if (m.dailyRecordId != null) return 'Saisie journalière';
  if (m.productionUnitId != null) return 'Lot';
  return 'Saisie manuelle';
}

/** Signed quantity: what the balance did, not the absolute size of the movement. */
export function signedQuantity(m: StockMovement): number {
  if (m.movementType === 'IN') return m.quantity;
  if (m.movementType === 'OUT') return -m.quantity;
  // An ADJUSTMENT's sign is whatever the balance actually did — the server sends the quantity
  // as an absolute, and only the before/after pair says which way it went.
  return m.quantityAfter - m.quantityBefore;
}

/** `YYYY-MM` of a movement date, for month grouping without pulling in a date library. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** "août 2026" — Hermes has no Intl, so month names cannot come from toLocaleDateString. */
export function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  const index = Number(month) - 1;
  return index >= 0 && index < 12 ? `${MONTHS[index]} ${year}` : key;
}

export type MovementGroup = { key: string; label: string; movements: StockMovement[] };

/** Newest first, grouped by month — the shape the ledger is read in. */
export function groupByMonth(movements: StockMovement[]): MovementGroup[] {
  const sorted = [...movements].sort((a, b) => b.movementDate.localeCompare(a.movementDate));
  const groups: MovementGroup[] = [];
  for (const m of sorted) {
    const key = monthKey(m.movementDate);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.movements.push(m);
    else groups.push({ key, label: monthLabel(key), movements: [m] });
  }
  return groups;
}

/**
 * How many days of stock are left at the recent consumption rate, or null when nothing has
 * been consumed. This is the number a farmer actually plans on — "42 sacs" means nothing
 * without knowing whether that is a week or two months.
 */
export function daysOfCover(
  currentQuantity: number,
  movements: StockMovement[],
  windowDays = 30,
  today: string = new Date().toISOString().slice(0, 10),
): number | null {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - windowDays);
  const from = cutoff.toISOString().slice(0, 10);

  const consumed = movements
    .filter((m) => m.movementType === 'OUT' && m.movementDate.slice(0, 10) >= from)
    .reduce((sum, m) => sum + m.quantity, 0);

  if (consumed <= 0 || currentQuantity <= 0) return null;
  const perDay = consumed / windowDays;
  return Math.floor(currentQuantity / perDay);
}
