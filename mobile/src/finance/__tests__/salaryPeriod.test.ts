import { lastMonth } from '../SalaryGenerateSheet';

describe('lastMonth', () => {
  it('proposes the month that has just ended, not the current one', () => {
    // A salary run happens once the month is over; defaulting to the current month would burn
    // a period that cannot be regenerated when it actually ends.
    expect(lastMonth(new Date('2026-08-30T12:00:00Z'))).toBe('2026-07');
  });

  it('rolls back across a year boundary', () => {
    expect(lastMonth(new Date('2026-01-15T12:00:00Z'))).toBe('2025-12');
  });

  it('pads a single-digit month, since the backend matches YYYY-MM strictly', () => {
    expect(lastMonth(new Date('2026-10-05T12:00:00Z'))).toBe('2026-09');
  });
});
