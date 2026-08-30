import {
  daysOfCover,
  groupByMonth,
  monthLabel,
  movementOrigin,
  reasonLabel,
  signedQuantity,
} from '../movements';
import type { StockMovement } from '@/types';

const base: StockMovement = {
  id: 1,
  stockItemId: 5,
  articleKey: 'feed_starter',
  movementType: 'OUT',
  movementDate: '2026-08-12',
  quantity: 10,
  quantityBefore: 100,
  quantityAfter: 90,
  reason: 'CONSUMPTION_LOT',
  productionUnitId: 3,
  purchaseOrderId: null,
  dailyRecordId: null,
  vaccinationId: null,
  treatmentExecutedId: null,
  unitPriceXof: null,
  totalValueXof: null,
  notes: null,
};

const at = (date: string, over: Partial<StockMovement> = {}): StockMovement => ({
  ...base,
  ...over,
  movementDate: date,
});

describe('movementOrigin', () => {
  it('names the purchase order a reception came from', () => {
    expect(movementOrigin({ ...base, purchaseOrderId: 12 })).toBe("Bon d'achat nº 12");
  });

  it('prefers the most specific origin when several ids are set', () => {
    // A treatment on a flock carries both ids; "Lot" would be the less useful of the two.
    expect(movementOrigin({ ...base, treatmentExecutedId: 4, productionUnitId: 3 })).toBe(
      'Traitement administré',
    );
  });

  it('says a hand-entered movement was hand-entered', () => {
    expect(movementOrigin({ ...base, productionUnitId: null })).toBe('Saisie manuelle');
  });
});

describe('signedQuantity', () => {
  it('makes an OUT negative and an IN positive', () => {
    expect(signedQuantity({ ...base, movementType: 'OUT' })).toBe(-10);
    expect(signedQuantity({ ...base, movementType: 'IN' })).toBe(10);
  });

  it('reads an adjustment from the balance, not from the quantity', () => {
    // The server sends an adjustment's quantity as an absolute; only before/after says the sign.
    expect(
      signedQuantity({
        ...base,
        movementType: 'ADJUSTMENT',
        quantity: 7,
        quantityBefore: 100,
        quantityAfter: 93,
      }),
    ).toBe(-7);
  });
});

describe('groupByMonth', () => {
  it('groups newest first, within and across months', () => {
    const groups = groupByMonth([at('2026-07-30'), at('2026-08-01'), at('2026-08-20')]);

    expect(groups.map((g) => g.key)).toEqual(['2026-08', '2026-07']);
    expect(groups[0]?.movements.map((m) => m.movementDate)).toEqual(['2026-08-20', '2026-08-01']);
  });

  it('returns nothing for an empty ledger rather than an empty group', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe('monthLabel', () => {
  it('names the month in French without Intl, which Hermes does not ship', () => {
    expect(monthLabel('2026-08')).toBe('août 2026');
  });
});

describe('daysOfCover', () => {
  it('divides the stock by the recent daily consumption', () => {
    // 30 out over 30 days = 1/day; 45 in stock = 45 days.
    const movements = [at('2026-08-20', { movementType: 'OUT', quantity: 30 })];
    expect(daysOfCover(45, movements, 30, '2026-08-30')).toBe(45);
  });

  it('ignores movements older than the window', () => {
    const movements = [at('2026-01-01', { movementType: 'OUT', quantity: 300 })];
    expect(daysOfCover(45, movements, 30, '2026-08-30')).toBeNull();
  });

  it('ignores incoming movements, which do not measure consumption', () => {
    const movements = [at('2026-08-20', { movementType: 'IN', quantity: 300 })];
    expect(daysOfCover(45, movements, 30, '2026-08-30')).toBeNull();
  });

  it('returns null on an empty stock rather than zero days', () => {
    // Zero would render as "0 jours de couverture", which reads as a forecast; there is none.
    const movements = [at('2026-08-20', { movementType: 'OUT', quantity: 30 })];
    expect(daysOfCover(0, movements, 30, '2026-08-30')).toBeNull();
  });
});

describe('reasonLabel', () => {
  it('translates the enum the operator never sees', () => {
    expect(reasonLabel('RECEPTION_PURCHASE')).toBe('Réception');
    expect(reasonLabel('INVENTORY_PHYSICAL')).toBe('Inventaire physique');
  });
});
