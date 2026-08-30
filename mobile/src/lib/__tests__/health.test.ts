/**
 * The health helpers, and in particular the withdrawal arithmetic.
 *
 * `projectWithdrawal` previews the earliest sale dates before anything is saved, so it has to
 * agree with the server exactly. A preview that disagreed with what the backend then computed
 * would be worse than showing nothing — the farmer would plan a sale on the wrong day.
 */
import {
  addDays,
  ageLabel,
  daysBetween,
  humanizeKey,
  isoToday,
  projectWithdrawal,
  routeLabel,
  scheduleStatusLabel,
  severityChip,
  withdrawalDaysRemaining,
} from '../health';

describe('projectWithdrawal', () => {
  it('counts the first day of treatment', () => {
    // Server: endDate = startDate.plusDays(durationDays - 1). A three-day course started on
    // the 1st ends on the 3rd, not the 4th.
    expect(projectWithdrawal('2026-08-01', 3, null, null).endDate).toBe('2026-08-03');
  });

  it('adds each declared delay to the end of the course', () => {
    const p = projectWithdrawal('2026-08-01', 3, 7, 2);

    expect(p.withdrawalEndDateMeat).toBe('2026-08-10');
    expect(p.withdrawalEndDateEggs).toBe('2026-08-05');
  });

  it('returns null for a delay the catalog does not declare', () => {
    const p = projectWithdrawal('2026-08-01', 3, 7, null);

    // Null is not zero: "no egg withdrawal declared" and "sell eggs today" are different claims,
    // and the screen says the first rather than implying the second.
    expect(p.withdrawalEndDateEggs).toBeNull();
    expect(p.withdrawalEndDateMeat).toBe('2026-08-10');
  });

  it('survives a one-day course', () => {
    expect(projectWithdrawal('2026-08-01', 1, 5, null).endDate).toBe('2026-08-01');
  });

  it('does not run the end date backwards on a zero duration', () => {
    expect(projectWithdrawal('2026-08-01', 0, null, null).endDate).toBe('2026-08-01');
  });

  it('crosses a month boundary', () => {
    expect(projectWithdrawal('2026-08-30', 3, 7, null).withdrawalEndDateMeat).toBe('2026-09-08');
  });
});

describe('withdrawalDaysRemaining', () => {
  const treatment = (meat: string | null, eggs: string | null) => ({
    withdrawalEndDateMeat: meat,
    withdrawalEndDateEggs: eggs,
  });

  it('reports the longer of the two delays still running', () => {
    // The farmer waits for the last one to clear, not the first.
    expect(withdrawalDaysRemaining(treatment('2026-08-10', '2026-08-05'), '2026-08-01')).toBe(9);
  });

  it('reports nothing once every delay has passed', () => {
    expect(withdrawalDaysRemaining(treatment('2026-08-01', '2026-07-28'), '2026-08-10')).toBeNull();
  });

  it('reports nothing when the catalog declared no delay', () => {
    expect(withdrawalDaysRemaining(treatment(null, null), '2026-08-01')).toBeNull();
  });

  it('ignores a delay that ends today', () => {
    // The delay is over on its end date; showing "J-0" would read as "still waiting".
    expect(withdrawalDaysRemaining(treatment('2026-08-01', null), '2026-08-01')).toBeNull();
  });
});

describe('dates', () => {
  it('measures whole days in both directions', () => {
    expect(daysBetween('2026-08-01', '2026-08-10')).toBe(9);
    expect(daysBetween('2026-08-10', '2026-08-01')).toBe(-9);
  });

  it('builds today from the local calendar, not UTC', () => {
    // A UTC slice flips the date after 21h in Dakar, dating an evening entry to tomorrow.
    const evening = new Date(2026, 7, 30, 23, 30);
    expect(isoToday(evening)).toBe('2026-08-30');
  });

  it('crosses a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('labels', () => {
  it('reads an age in weeks or days', () => {
    expect(ageLabel(6, 'WEEK')).toBe('S6');
    expect(ageLabel(28, 'DAY')).toBe('J28');
  });

  it('gives a severity its French name', () => {
    // The lists used to print the raw enum: a farmer read "CRITICAL" on an otherwise French screen.
    expect(severityChip('CRITICAL').label).toBe('Critique');
    expect(severityChip('WARNING').label).toBe('Vigilance');
    expect(severityChip('NORMAL').label).toBe('Normal');
  });

  it('names every schedule status', () => {
    expect(scheduleStatusLabel('DONE')).toBe('Effectué');
    expect(scheduleStatusLabel('LATE')).toBe('En retard');
    expect(scheduleStatusLabel('UPCOMING')).toBe('À venir');
  });

  it('falls back to a readable route rather than a raw key', () => {
    expect(routeLabel('drinking_water')).toBe('Eau de boisson');
    // An unknown route still reads as words, not as a database key.
    expect(routeLabel('nouvelle_voie')).toBe('Nouvelle Voie');
  });

  it('title-cases a catalog key', () => {
    expect(humanizeKey('newcastle_b1')).toBe('Newcastle B1');
  });
});
