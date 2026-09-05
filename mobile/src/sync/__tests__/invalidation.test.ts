import { tagsForKinds } from '../invalidation';
import type { MutationKind } from '../types';

const ALL_KINDS: MutationKind[] = [
  'DAILY_RECORD',
  'MORTALITY',
  'WEIGHING',
  'EGG_COLLECTION',
  'VACCINATION',
  'HEALTH_OBSERVATION',
  'CREATE_CLIENT',
  'STOCK_ADJUSTMENT',
  'EXPENSE',
  'TREATMENT',
];

describe('tagsForKinds', () => {
  it('gives every kind something to refresh', () => {
    // A kind added to the queue without a mapping would silently sync and leave the screen empty —
    // the exact defect this table exists to close. Adding a MutationKind must fail here first.
    // Collected rather than asserted one by one so the failure names the unmapped kind.
    const unmapped = ALL_KINDS.filter((kind) => tagsForKinds([kind]).length === 0);

    expect(unmapped).toEqual([]);
  });

  it('refreshes the headcount and the event ledger after a mortality', () => {
    expect(tagsForKinds(['MORTALITY'])).toEqual([
      'ProductionUnit',
      'UnitEvent',
      'Performance',
      'Dashboard',
    ]);
  });

  it('refreshes the stock after a daily record, because a formula consumes feed', () => {
    expect(tagsForKinds(['DAILY_RECORD'])).toContain('StockMovement');
    expect(tagsForKinds(['DAILY_RECORD'])).toContain('InventoryAlert');
  });

  it('refreshes the vaccination schedule, not just the vaccination list', () => {
    expect(tagsForKinds(['VACCINATION'])).toContain('HealthSchedule');
  });

  it('does not refresh the egg lists after a mortality', () => {
    // The point of mapping kind by kind: a field phone must not refetch everything on any success.
    expect(tagsForKinds(['MORTALITY'])).not.toContain('EggCollection');
  });

  it('merges several kinds without repeating a tag', () => {
    const tags = tagsForKinds(['MORTALITY', 'DAILY_RECORD', 'MORTALITY']);

    expect(new Set(tags).size).toBe(tags.length);
    expect(tags).toContain('ProductionUnit');
    expect(tags).toContain('DailyRecord');
    expect(tags.filter((t) => t === 'Dashboard')).toHaveLength(1);
  });

  it('asks for nothing when nothing was sent', () => {
    expect(tagsForKinds([])).toEqual([]);
  });
});
