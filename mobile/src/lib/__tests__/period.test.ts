import { periodToRange } from '../period';

describe('periodToRange', () => {
  const days = (r: { from: string; to: string }) =>
    (Date.parse(r.to) - Date.parse(r.from)) / 86_400_000;

  it('spans seven inclusive days for 7d', () => {
    expect(days(periodToRange('7d'))).toBe(6); // inclusive bounds: 6 gaps span 7 days
  });

  it('spans thirty inclusive days for 30d', () => {
    expect(days(periodToRange('30d'))).toBe(29);
  });

  it('spans ninety inclusive days for 90d', () => {
    expect(days(periodToRange('90d'))).toBe(89);
  });

  it('ends today', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(periodToRange('30d').to).toBe(expected);
  });
});
