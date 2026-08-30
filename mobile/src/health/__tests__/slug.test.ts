import { slugify } from '../slug';

describe('slugify', () => {
  it('lowercases and joins words with underscores', () => {
    expect(slugify('Newcastle La Sota')).toBe('newcastle_la_sota');
  });

  it('strips accents so one medication does not become two', () => {
    // A key is what flocks, treatments and withdrawal snapshots point at. "Amoxicilline" typed
    // with and without an accent must land on the same entry.
    expect(slugify('Amoxicillíne 50%')).toBe('amoxicilline_50');
  });

  it('collapses punctuation and spacing', () => {
    expect(slugify('  Vitamine  A / D3 - E  ')).toBe('vitamine_a_d3_e');
  });

  it('leaves no leading or trailing underscore', () => {
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
