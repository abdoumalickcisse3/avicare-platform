import { render, screen } from '@testing-library/react-native';
import type { UnitClosure } from '@/store/api/closureApi';

const closure: UnitClosure = {
  productionUnitId: 42,
  closedAt: '2026-09-02T10:00:00',
  startDate: '2026-07-19',
  endDate: '2026-09-02',
  durationDays: 45,
  initialCount: 1000,
  remainingCount: 180,
  deaths: 20,
  mortalityPercent: 2,
  exitWeightG: 2000,
  avgDailyGainG: 44.44,
  totalFeedKg: 2250,
  feedConversionRatio: 1.148,
  revenueXof: 1_800_000,
  feedCostXof: 900_000,
  chickCostXof: 250_000,
  otherExpenseXof: 90_000,
  totalCostXof: 1_240_000,
  marginXof: 560_000,
  costPerKgXof: 633,
  consumedArticles: 1,
  valuedArticles: 1,
  valuationIncomplete: false,
  notes: null,
};

// Prefixed `mock` so babel-plugin-jest-hoist allows the factory to close over it.
let mockData: UnitClosure = closure;

jest.mock('@/store/api/closureApi', () => ({
  useGetUnitClosureQuery: jest.fn(() => ({ data: mockData, isLoading: false, error: undefined })),
  useReopenUnitMutation: jest.fn(() => [
    jest.fn(() => ({ unwrap: () => Promise.resolve() })),
    { isLoading: false },
  ]),
}));

// eslint-disable-next-line import/first
import { BatchClosureCard } from '../BatchClosureCard';

function setup(override: Partial<UnitClosure> = {}) {
  mockData = { ...closure, ...override };
  return render(<BatchClosureCard farmId={7} unitId={42} canReopen />);
}

describe('BatchClosureCard', () => {
  it('shows the technical and financial figures', async () => {
    await setup();

    expect(screen.getByText('45 jours')).toBeTruthy();
    expect(screen.getByText('2 %')).toBeTruthy();
    expect(screen.getByText('1.148')).toBeTruthy();
    expect(screen.getByText('Coût de revient au kg vif')).toBeTruthy();
  });

  it('warns when some consumed article had no price', async () => {
    await setup({ consumedArticles: 4, valuedArticles: 2, valuationIncomplete: true });

    expect(screen.getByText(/2 articles consommés n'ont pas de prix/)).toBeTruthy();
    expect(screen.getByText(/Le coût réel est plus élevé/)).toBeTruthy();
  });

  it('uses the singular for a single unpriced article', async () => {
    await setup({ consumedArticles: 2, valuedArticles: 1, valuationIncomplete: true });

    expect(screen.getByText(/1 article consommé n'a pas de prix/)).toBeTruthy();
  });

  it('stays silent when every article was valued', async () => {
    await setup();

    expect(screen.queryByText(/pas de prix/)).toBeNull();
  });

  it('shows a dash rather than a zero when the batch was never weighed', async () => {
    await setup({ exitWeightG: null, costPerKgXof: null, feedConversionRatio: null });

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('hides the reopen action from a role that may not use it', async () => {
    mockData = closure;
    await render(<BatchClosureCard farmId={7} unitId={42} canReopen={false} />);

    expect(screen.queryByLabelText('Rouvrir la bande')).toBeNull();
  });

  it('offers the reopen action to a supervisor', async () => {
    await setup();

    expect(screen.getByLabelText('Rouvrir la bande')).toBeTruthy();
  });
});
