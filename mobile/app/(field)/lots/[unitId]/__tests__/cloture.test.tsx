import { act, fireEvent, render, screen } from '@testing-library/react-native';

// React 19 + RNTL 14: fireEvent schedules a state update that isn't flushed by the time it
// returns, so each interaction is wrapped in an async act — see mortalite.test.tsx.
const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const type = (el: Parameters<typeof fireEvent.changeText>[0], text: string): Promise<void> =>
  act(async () => {
    fireEvent.changeText(el, text);
  });

type CloseUnitArgs = { farmId: number; unitId: number; body: Record<string, unknown> };
const mockClose = jest.fn((_args: CloseUnitArgs) => ({ unwrap: () => Promise.resolve({}) }));
const mockBack = jest.fn();
let mockRole = 'OWNER';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ unitId: '3' })),
  useRouter: jest.fn(() => ({ back: mockBack, push: jest.fn() })),
  Redirect: () => null,
}));

jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));

jest.mock('@/store/api/productionUnitsApi', () => ({
  useListProductionUnitsQuery: jest.fn(() => ({
    data: [
      { id: 3, farmId: 7, currentCount: 180, name: 'B-12', startDate: '2026-06-01', species: 'POULTRY' },
    ],
    isLoading: false,
    isError: false,
  })),
}));

jest.mock('@/store/api/closureApi', () => ({
  useCloseUnitMutation: jest.fn(() => [mockClose, { isLoading: false }]),
}));

let mockChickPurchaseCostXof: number | null = null;

jest.mock('@/store/api/poultryBatchesApi', () => ({
  useGetBatchQuery: jest.fn(() => ({
    data: { chickPurchaseCostXof: mockChickPurchaseCostXof },
    isLoading: false,
    isError: false,
  })),
}));

jest.mock('@/auth/useSession', () => ({
  useFarmAccess: jest.fn(() => ({ farmRole: mockRole, isAdmin: false, session: null, can: () => true })),
}));

// eslint-disable-next-line import/first
import CloseBatchScreen from '../cloture';

describe('CloseBatchScreen', () => {
  beforeEach(() => {
    mockClose.mockClear();
    mockBack.mockClear();
    mockRole = 'OWNER';
    mockChickPurchaseCostXof = null;
  });

  it('warns that the report will be frozen', async () => {
    await render(<CloseBatchScreen />);
    expect(screen.getByText(/figé/)).toBeTruthy();
  });

  it('says how many subjects are still on hand', async () => {
    await render(<CloseBatchScreen />);
    expect(screen.getByText(/Il reste 180 sujets/)).toBeTruthy();
  });

  it('closes without a chick cost — the field is optional', async () => {
    await render(<CloseBatchScreen />);

    await press(screen.getByLabelText('Clôturer la bande'));

    expect(mockClose).toHaveBeenCalledWith({
      farmId: 7,
      unitId: 3,
      body: { chickCostXof: undefined, notes: undefined },
    });
  });

  it('passes the chick cost as a number when given', async () => {
    await render(<CloseBatchScreen />);

    await type(screen.getByPlaceholderText('0'), '250000');
    await press(screen.getByLabelText('Clôturer la bande'));

    expect(mockClose).toHaveBeenCalledWith({
      farmId: 7,
      unitId: 3,
      body: { chickCostXof: 250000, notes: undefined },
    });
  });

  it('refuses a FARMER, and says why', async () => {
    mockRole = 'FARMER';
    await render(<CloseBatchScreen />);

    expect(screen.getByText(/Seul un propriétaire ou un gestionnaire/)).toBeTruthy();
    await press(screen.getByLabelText('Clôturer la bande'));
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('shows a read-only summary — no re-entry — when a chick cost is already recorded', async () => {
    mockChickPurchaseCostXof = 150_000;
    await render(<CloseBatchScreen />);

    expect(screen.getByText(/déjà enregistré/)).toBeTruthy();
    expect(screen.getByText('150 000 FCFA')).toBeTruthy();
    expect(screen.queryByPlaceholderText('0')).toBeNull();
  });

  it('omits chickCostXof from the payload when a cost is already recorded', async () => {
    mockChickPurchaseCostXof = 150_000;
    await render(<CloseBatchScreen />);

    await press(screen.getByLabelText('Clôturer la bande'));

    expect(mockClose).toHaveBeenCalledTimes(1);
    const body = mockClose.mock.calls[0]![0].body;
    expect(body).not.toHaveProperty('chickCostXof');
    expect(body).toEqual({ notes: undefined });
  });
});
