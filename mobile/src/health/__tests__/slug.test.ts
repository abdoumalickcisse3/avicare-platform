import { slugify } from '../slug';

describe('slugify', () => {
  /**
   * The separator is a hyphen, exactly as `web/src/lib/slug.ts` derives it. It used to be an
   * underscore here, which meant the same medication typed on the phone and on the web produced
   * two keys, two catalog entries and two stock balances for one bottle — the duplication ADR-020
   * exists to stop.
   */
  it('lowercases and joins words with hyphens, like the web', () => {
    expect(slugify('Newcastle La Sota')).toBe('newcastle-la-sota');
  });

  it('strips accents so one medication does not become two', () => {
    // A key is what flocks, treatments and withdrawal snapshots point at. "Amoxicilline" typed
    // with and without an accent must land on the same entry.
    expect(slugify('Amoxicillíne 50%')).toBe('amoxicilline-50');
  });

  it('collapses punctuation and spacing', () => {
    expect(slugify('  Vitamine  A / D3 - E  ')).toBe('vitamine-a-d3-e');
  });

  it('leaves no leading or trailing separator', () => {
    expect(slugify('!! Coccidiose !!')).toBe('coccidiose');
  });

  it('caps the length the column accepts', () => {
    expect(slugify('a'.repeat(200)).length).toBe(100);
  });

  it('returns an empty key for a label with nothing usable', () => {
    // The caller refuses to submit on this rather than posting an empty key.
    expect(slugify('!!!')).toBe('');
  });
});
