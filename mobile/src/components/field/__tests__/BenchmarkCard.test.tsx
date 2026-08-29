import { render } from '@testing-library/react-native';
import { BenchmarkCard } from '../BenchmarkCard';
import { useGetBenchmarkComparisonQuery } from '@/store/api/benchmarksApi';

jest.mock('@/store/api/benchmarksApi', () => ({
  useGetBenchmarkComparisonQuery: jest.fn(),
}));

const mockQuery = useGetBenchmarkComparisonQuery as jest.Mock;

function comparison(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      available: true,
      unavailableReason: null,
      cohortSize: 7,
      platformMortalityRate: '6.00',
      farmMortalityRate: '4.20',
      ...overrides,
    },
  };
}

describe('BenchmarkCard', () => {
  it('compares the farm against the cohort', async () => {
    mockQuery.mockReturnValue(comparison());
    const { getByText } = await render(<BenchmarkCard farmId={8} />);

    expect(getByText('4.20 %')).toBeTruthy();
    expect(getByText('6.00 %')).toBeTruthy();
    expect(getByText('7 fermes')).toBeTruthy();
    expect(getByText(/perdez moins d'animaux/)).toBeTruthy();
  });

  it('says so plainly when the farm is doing worse', async () => {
    mockQuery.mockReturnValue(
      comparison({ platformMortalityRate: '4.00', farmMortalityRate: '9.10' }),
    );
    const { getByText } = await render(<BenchmarkCard farmId={8} />);

    // A comparison that only ever flatters is one nobody acts on.
    expect(getByText(/perdez plus d'animaux/)).toBeTruthy();
  });

  it('renders nothing when the platform has comparison off', async () => {
    mockQuery.mockReturnValue(
      comparison({
        available: false,
        unavailableReason: "La comparaison entre fermes n'est pas activée.",
        platformMortalityRate: null,
        farmMortalityRate: null,
      }),
    );
    const { toJSON } = await render(<BenchmarkCard farmId={8} />);

    // An empty card explaining an absent feature is noise on a screen opened in a barn.
    expect(toJSON()).toBeNull();
  });

  it('explains a cohort that is still too small', async () => {
    mockQuery.mockReturnValue(
      comparison({
        available: false,
        unavailableReason: 'Comparaison indisponible : moins de 5 fermes comparables.',
        platformMortalityRate: null,
        farmMortalityRate: null,
      }),
    );
    const { getByText } = await render(<BenchmarkCard farmId={8} />);

    // This one resolves on its own as the platform grows, so it is worth explaining.
    expect(getByText(/moins de 5 fermes comparables/)).toBeTruthy();
  });

  it('never claims a rate it was not given', async () => {
    mockQuery.mockReturnValue(comparison({ farmMortalityRate: null }));
    const { getByText, queryByText } = await render(<BenchmarkCard farmId={8} />);

    // A farm with no flock yet must read "—", not "0 %", which would look like perfect husbandry.
    expect(getByText('—')).toBeTruthy();
    expect(queryByText(/perdez/)).toBeNull();
  });

  it('renders nothing while the answer has not arrived', async () => {
    mockQuery.mockReturnValue({ data: undefined });
    const { toJSON } = await render(<BenchmarkCard farmId={8} />);

    expect(toJSON()).toBeNull();
  });
});
