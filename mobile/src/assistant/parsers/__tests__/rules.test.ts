import { rulesParse } from '..';
import { weighingParser } from '../weighingParser';
import type { ParseContext } from '../../types';

const CTX: ParseContext = { unitId: 3 };

describe('weighingParser', () => {
  it('extracts gram weights after the weighing keyword', () => {
    const r = weighingParser.parse('pesée 1850 1920 2010', CTX);
    expect(r?.kind).toBe('WEIGHING');
    expect(r?.weights).toEqual([1850, 1920, 2010]);
    expect(r?.unitId).toBe(3);
  });

  it('ignores small counts (< 50 g) as non-weights', () => {
    expect(weighingParser.parse('peser 1850, 2 fois', CTX)?.weights).toEqual([1850]);
  });

  it('returns null without the weighing keyword', () => {
    expect(weighingParser.parse('1850 1920', CTX)).toBeNull();
  });
});

describe('rulesParse (combined)', () => {
  it('routes a weighing phrase to WEIGHING', () => {
    expect(rulesParse('pesée 1850 1920', CTX)?.kind).toBe('WEIGHING');
  });

  it('routes a mortality phrase to MORTALITY', () => {
    expect(rulesParse('dix sont morts', CTX)?.kind).toBe('MORTALITY');
  });

  it('routes a daily entry to DAILY_RECORD, not to MORTALITY', () => {
    // Both parsers see "3 morts"; the daily phrasing must win so the feed and water are kept.
    const out = rulesParse('saisie du jour 3 morts 120 kg aliment', CTX);
    expect(out?.kind).toBe('DAILY_RECORD');
    expect(out).toMatchObject({ mortalityCount: 3, feedKg: 120 });
  });

  it('routes a collection to EGG_COLLECTION', () => {
    expect(rulesParse('ramassage du matin 320 oeufs', CTX)?.kind).toBe('EGG_COLLECTION');
  });

  it('still routes a bare mortality phrase to MORTALITY', () => {
    // Adding parsers ahead of it must not shadow the catch-all.
    expect(rulesParse('dix sont morts', CTX)?.kind).toBe('MORTALITY');
    expect(rulesParse("j'ai perdu 3 poules", CTX)?.kind).toBe('MORTALITY');
  });

  it('returns null for an unrecognized phrase (→ LLM fallback)', () => {
    expect(rulesParse("j'ai vendu 30 poulets", CTX)).toBeNull();
    // A collection without a usable timeslot stays with the LLM.
    expect(rulesParse('ramassage 320 oeufs', CTX)).toBeNull();
  });
});
