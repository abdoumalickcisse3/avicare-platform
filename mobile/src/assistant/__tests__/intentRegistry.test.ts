import { toMutation } from '../intentRegistry';
import type { AssistantIntent } from '../types';

const FARM = 7;

describe('intentRegistry.toMutation', () => {
  it('returns null when the lot is unresolved', () => {
    const intent: AssistantIntent = { kind: 'MORTALITY', count: 3, unitId: null };
    expect(toMutation(intent, FARM)).toBeNull();
  });

  it('maps MORTALITY to the production-unit endpoint', () => {
    const m = toMutation({ kind: 'MORTALITY', count: 10, reason: 'chaleur', unitId: 3 }, FARM);
    expect(m?.kind).toBe('MORTALITY');
    expect(m?.endpoint).toBe('/api/v1/farms/7/production-units/3/mortality');
    expect(m?.payload).toMatchObject({ count: 10, reason: 'chaleur' });
    // clientRef is put in both the row and the payload.
    expect((m?.payload as { clientRef: unknown }).clientRef).toBe(m?.clientRef);
  });

  it('maps DAILY_RECORD to the daily-records endpoint', () => {
    const m = toMutation({ kind: 'DAILY_RECORD', mortalityCount: 2, feedKg: 25, waterL: 40, unitId: 3 }, FARM);
    expect(m?.kind).toBe('DAILY_RECORD');
    expect(m?.endpoint).toBe('/api/v1/farms/7/poultry-batches/3/daily-records');
    expect(m?.payload).toMatchObject({ mortalityCount: 2, feedKg: 25, waterL: 40 });
  });

  it('maps WEIGHING to the weighings endpoint with the individual weights', () => {
    const m = toMutation({ kind: 'WEIGHING', weights: [1850, 1920], unitId: 3 }, FARM);
    expect(m?.endpoint).toBe('/api/v1/farms/7/poultry-batches/3/weighings');
    expect((m?.payload as { individualWeights: number[] }).individualWeights).toEqual([1850, 1920]);
  });

  it('maps EGG_COLLECTION with a deterministic per-slot clientRef', () => {
    const m = toMutation({ kind: 'EGG_COLLECTION', totalEggs: 30, brokenEggs: 1, timeslotKey: 'morning', unitId: 4 }, FARM);
    expect(m?.endpoint).toBe('/api/v1/farms/7/egg-production/collections');
    expect(m?.payload).toMatchObject({ unitId: 4, timeslotKey: 'morning', totalEggs: 30, brokenEggs: 1 });
    expect(m?.clientRef).toMatch(/^egg-4-\d{4}-\d{2}-\d{2}-morning$/);
  });

  it('maps VACCINATION to the vaccinations endpoint with today and the count', () => {
    const m = toMutation(
      { kind: 'VACCINATION', vaccineKey: 'newcastle', vaccineLabel: 'Newcastle', subjectsCount: 500, unitId: 3 },
      FARM,
    );
    expect(m?.kind).toBe('VACCINATION');
    expect(m?.endpoint).toBe('/api/v1/farms/7/health/vaccinations');
    expect(m?.payload).toMatchObject({ unitId: 3, vaccineKey: 'newcastle', subjectsCount: 500 });
    expect((m?.payload as { administeredDate: string }).administeredDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('maps HEALTH_OBSERVATION to the observations endpoint, omitting empty optionals', () => {
    const m = toMutation(
      { kind: 'HEALTH_OBSERVATION', title: 'les poules toussent', severity: 'CRITICAL', unitId: 3 },
      FARM,
    );
    expect(m?.kind).toBe('HEALTH_OBSERVATION');
    expect(m?.endpoint).toBe('/api/v1/farms/7/health/observations');
    expect(m?.payload).toMatchObject({ unitId: 3, title: 'les poules toussent', severity: 'CRITICAL' });
    expect((m?.payload as { suspectedDisease?: string }).suspectedDisease).toBeUndefined();
  });
});
