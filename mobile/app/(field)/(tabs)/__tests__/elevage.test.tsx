/**
 * The Élevage batch list: the per-row figure band and its mortality signal.
 */
import { render, screen } from '@testing-library/react-native';
import type { PoultryBatch } from '@/types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));

const healthyBatch: PoultryBatch = {
  id: 1,
  farmId: 7,
  breedId: 1,
  name: 'Bande A',
  startDate: '2026-09-01',
  status: 'ACTIVE',
  currentCount: 498,
  initialCount: 500,
  // 2 sold, none died — deaths is the ledger, never initialCount - currentCount.
  deaths: 0,
  targetWeightG: null,
  targetAgeDays: 42,
  chickPurchaseCostXof: null,
};

const sickBatch: PoultryBatch = {
  ...healthyBatch,
  id: 2,
  name: 'Bande B',
  currentCount: 460,
  initialCount: 500,
  // 40/500 = 8%, above the 5% visual threshold.
  deaths: 40,
};

const mildBatch: PoultryBatch = {
  ...healthyBatch,
  id: 3,
  name: 'Bande C',
  currentCount: 495,
  initialCount: 500,
  // 5/500 = 1%, below the threshold, but still > 0 deaths.
  deaths: 5,
};

let mockBatches: PoultryBatch[] = [healthyBatch];
jest.mock('@/store/api/poultryBatchesApi', () => ({
  useGetBatchesQuery: () => ({ data: mockBatches, isLoading: false }),
}));

// eslint-disable-next-line import/first
import ElevageScreen from '../elevage';

beforeEach(() => {
  mockBatches = [healthyBatch];
});

describe('ElevageScreen', () => {
  it('shows headcount, mortality and starting count for a batch', async () => {
    await render(<ElevageScreen />);

    expect(screen.getByText('498')).toBeTruthy();
    expect(screen.getByText('500')).toBeTruthy();
    expect(screen.getByText('Effectif')).toBeTruthy();
    expect(screen.getByText('Mortalité')).toBeTruthy();
    expect(screen.getByText('Départ')).toBeTruthy();
  });

  it('tints the mortality figure red once a batch has lost a bird, without a high-mortality dot', async () => {
    mockBatches = [mildBatch];
    await render(<ElevageScreen />);

    expect(screen.getByText('5').props.style).toContainEqual(
      expect.objectContaining({ color: '#DC2626' }),
    );
    expect(screen.queryByLabelText('Mortalité élevée')).toBeNull();
  });

  it('adds a high-mortality dot once losses cross the visual threshold, same red as the figure', async () => {
    mockBatches = [sickBatch];
    await render(<ElevageScreen />);

    expect(screen.getByLabelText('Mortalité élevée')).toBeTruthy();
    expect(screen.getByLabelText('Mortalité élevée').props.style).toMatchObject({
      backgroundColor: '#DC2626',
    });
  });

  it('leaves a healthy batch without any mortality tint or dot', async () => {
    await render(<ElevageScreen />);

    expect(screen.getByText('0').props.style).not.toContainEqual(
      expect.objectContaining({ color: '#DC2626' }),
    );
    expect(screen.queryByLabelText('Mortalité élevée')).toBeNull();
  });
});
