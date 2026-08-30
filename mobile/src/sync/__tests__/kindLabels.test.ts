/**
 * Every queued mutation kind must have a French label.
 *
 * `KIND_LABELS` is typed `Record<MutationKind, string>`, so the compiler already refuses an
 * incomplete map — but a future `Partial<>`, or a label left as an empty string, would slip
 * past it and the queue screen would show `undefined` to a farmer trying to understand why
 * a day's entry never left the phone. That screen is the only place a terminal failure can
 * be seen or resolved, so it is the last place that should be vague.
 *
 * The map lives in `sync/` rather than in the screen so this test can read it without
 * pulling a whole route and its native dependencies into Jest.
 *
 * The list below is spelled out rather than derived from the type: a test that reads its
 * expectations from the thing it checks agrees with itself by construction.
 */
import { KIND_LABELS } from '../kindLabels';
import type { MutationKind } from '../types';

const EXPECTED_KINDS: MutationKind[] = [
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

describe('KIND_LABELS', () => {
  it('covers every kind the queue can hold', () => {
    for (const kind of EXPECTED_KINDS) {
      expect(Object.keys(KIND_LABELS)).toContain(kind);
    }
  });

  it('labels nothing with an empty string', () => {
    for (const [kind, label] of Object.entries(KIND_LABELS)) {
      expect(label.trim().length).toBeGreaterThan(0);
      // A key echoed back as its own label is the same failure, dressed up.
      expect(label).not.toBe(kind);
    }
  });

  it('has no label left over from a kind that no longer exists', () => {
    expect(Object.keys(KIND_LABELS).sort()).toEqual([...EXPECTED_KINDS].sort());
  });
});
