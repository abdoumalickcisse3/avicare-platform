import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ClosureSummary } from '@/store/api/closureListApi';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const row = (over: Partial<ClosureSummary>): ClosureSummary => ({
  productionUnitId: 1,
  unitName: 'Bande A',
  startDate: '2026-07-01',
  endDate: '2026-08-15',
  durationDays: 45,
  initialCount: 1000,
  deaths: 20,
  mortalityPercent: 2,
  exitWeightG: 2000,
  feedConversionRatio: 1.9,
  revenueXof: 1_800_000,
  totalCostXof: 1_240_000,
  marginXof: 560_000,
  costPerKgXof: 633,
  valuationIncomplete: false,
  ...over,
});

let mockRows: ClosureSummary[] = [];

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ back: jest.fn(), push: jest.fn() })),
  Redirect: () => null,
}));

jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));

jest.mock('@/store/api/closureListApi', () => ({
  useGetFarmClosuresQuery: jest.fn(() => ({ data: mockRows, isLoading: false })),
}));

// eslint-disable-next-line import/first
import ClosuresScreen from '../bilans';

function setup(data: ClosureSummary[]) {
  mockRows = data;
  return render(<ClosuresScreen />);
}

/** The cards render in order, so their accessibility labels give the ranking. */
const order = () =>
  screen.getAllByLabelText(/^Bilan /).map((n) => n.props.accessibilityLabel as string);

describe('ClosuresScreen', () => {
  it('invites the farmer to close a batch when there is none', async () => {
    await setup([]);
    expect(screen.getByText(/Aucune bande clôturée/)).toBeTruthy();
  });

  it('lists a closed cycle with its comparable figures', async () => {
    await setup([row({})]);

    expect(screen.getByText('Bande A')).toBeTruthy();
    expect(screen.getByText('2 %')).toBeTruthy();
    expect(screen.getByText('1.9')).toBeTruthy();
  });

  it('ranks on the criterion the reader picks', async () => {
    await setup([
      row({ productionUnitId: 1, unitName: 'Faible', marginXof: 100 }),
      row({ productionUnitId: 2, unitName: 'Forte', marginXof: 900 }),
    ]);

    await press(screen.getByLabelText('Trier par Meilleure marge'));

    expect(order()[0]).toContain('Forte');
  });

  it('sinks an unknown to the bottom rather than ranking it first', async () => {
    await setup([
      row({ productionUnitId: 1, unitName: 'Sans IC', feedConversionRatio: null }),
      row({ productionUnitId: 2, unitName: 'Avec IC', feedConversionRatio: 1.5 }),
    ]);

    await press(screen.getByLabelText('Trier par Meilleur IC'));

    expect(order()[1]).toContain('Sans IC');
  });

  it('warns that a partly valued batch compares too favourably', async () => {
    await setup([row({ valuationIncomplete: true })]);

    expect(screen.getByText(/leur coût est sous-estimé/)).toBeTruthy();
  });

  it('stays silent when every batch was fully valued', async () => {
    await setup([row({})]);

    expect(screen.queryByText(/sous-estimé/)).toBeNull();
  });
});
