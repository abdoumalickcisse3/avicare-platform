import { fireEvent, render, screen } from '@testing-library/react-native';

/**
 * Same seams as the sibling screen tests: `expo-router` and `react-redux` are mocked, the API
 * modules are stubbed per module, and the heavy children (charts, health, closure) are replaced
 * so the assertions are about this screen's own navigation.
 */

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ unitId: '3' })),
  useRouter: jest.fn(() => ({ back: jest.fn(), push: mockPush })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
jest.mock('@/auth/useSession', () => ({
  useFarmAccess: jest.fn(() => ({ can: () => true, isAdmin: true, farmRole: 'OWNER', session: null })),
}));
jest.mock('@/store/api/poultryBatchesApi', () => ({
  useGetBatchQuery: jest.fn(() => ({
    data: {
      id: 3,
      name: 'Lot A',
      status: 'ACTIVE',
      initialCount: 500,
      currentCount: 490,
      startDate: '2026-09-01',
      breedKey: 'cobb_500',
    },
  })),
  useGetDailyRecordsQuery: jest.fn(() => ({ data: [] })),
  useGetPerformanceQuery: jest.fn(() => ({ data: undefined })),
  useGetWeighingsQuery: jest.fn(() => ({ data: [] })),
}));
jest.mock('@/store/api/breedsApi', () => ({ useListBreedsQuery: jest.fn(() => ({ data: [] })) }));
jest.mock('@/components/charts/GrowthChart', () => ({ GrowthChart: () => null }));
jest.mock('@/components/charts/MortalityChart', () => ({ MortalityChart: () => null }));
jest.mock('@/components/charts/FeedConsumptionChart', () => ({ FeedConsumptionChart: () => null }));
jest.mock('@/components/health/HealthSection', () => ({ HealthSection: () => null }));
jest.mock('@/components/poultry/BatchClosureCard', () => ({ BatchClosureCard: () => null }));
jest.mock('@/components/poultry/ChickCostSheet', () => ({ ChickCostSheet: () => null }));
jest.mock('@/components/assistant/MicButton', () => ({ MicButton: () => null }));

import BatchScreen from '../index';

beforeEach(() => mockPush.mockReset());

describe('Fiche de lot — le bouton +', () => {
  it('mène à la saisie du jour, pas à la seule mortalité', async () => {
    await render(<BatchScreen />);

    fireEvent.press(screen.getByLabelText('Saisie du jour'));

    expect(mockPush).toHaveBeenCalledWith('/(field)/lots/3/journalier');
  });
});
