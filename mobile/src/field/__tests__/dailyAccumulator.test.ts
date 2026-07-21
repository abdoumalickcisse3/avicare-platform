import { accumulateDaily } from '../dailyAccumulator';

describe('daily accumulator', () => {
  it('starts from zero on the first entry', () => {
    expect(accumulateDaily(null, { mortalityCount: 1 }).mortalityCount).toBe(1);
  });

  it('adds successive mortalities into a running total', () => {
    let d = accumulateDaily(null, { mortalityCount: 1 });
    d = accumulateDaily(d, { mortalityCount: 1 });
    d = accumulateDaily(d, { mortalityCount: 1 });
    expect(d.mortalityCount).toBe(3);
  });

  it('replaces feed and water instead of adding them', () => {
    let d = accumulateDaily(null, { feedKg: 25 });
    d = accumulateDaily(d, { feedKg: 30 });
    expect(d.feedKg).toBe(30);
  });

  it('never goes below zero on a correction', () => {
    const d = accumulateDaily({ mortalityCount: 2, feedKg: 0, waterL: 0 }, { mortalityCount: -5 });
    expect(d.mortalityCount).toBe(0);
  });
});
