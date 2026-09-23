import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const mockCreateSale = jest.fn(() => ({ unwrap: () => Promise.resolve({ id: 1, totalXof: 0 }) }));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
jest.mock('@/auth/useSession', () => ({
  useFarmAccess: jest.fn(() => ({ farmRole: 'OWNER', can: () => true, isAdmin: true, session: null })),
}));
jest.mock('@/commerce/useProductionAvailability', () => ({
  useProductionAvailability: jest.fn(() => ({
    broilerLots: [{ unitId: 5, label: 'Lot A', heads: 100 }],
    eggsAvailable: 0,
    loading: false,
  })),
}));
jest.mock('@/store/api/clientsApi', () => ({ useGetClientsQuery: jest.fn(() => ({ data: [] })) }));
jest.mock('@/store/api/catalogApi', () => ({ useGetCatalogQuery: jest.fn(() => ({ data: [] })) }));
jest.mock('@/store/api/salesApi', () => ({
  useCreateSaleMutation: jest.fn(() => [mockCreateSale, { isLoading: false }]),
}));

const mockFetchPerformance = jest.fn(() => ({
  unwrap: () =>
    Promise.resolve({
      poultryBatchId: 5,
      snapshotDate: '2026-09-20',
      currentWeightG: 1800,
      ageDays: 30,
      gmqGPerDay: 60,
      feedConversionRatio: 1.8,
      cumulativeMortalityPercent: 2,
      cumulativeFeedKg: 90,
      forecastedTargetDate: null,
      performanceScore: 'ON_TARGET',
    }),
}));
jest.mock('@/store/api/poultryBatchesApi', () => ({
  useLazyGetPerformanceQuery: jest.fn(() => [mockFetchPerformance]),
}));

import VenteScreen from '../vente';

describe('Vente directe', () => {
  beforeEach(() => mockCreateSale.mockClear());

  it('adds a broiler lot and submits a walk-in cash sale', async () => {
    await render(<VenteScreen />);
    await press(screen.getByLabelText('Ajouter Lot A à la vente'));
    await press(screen.getByLabelText('Valider la vente'));
    expect(mockCreateSale).toHaveBeenCalledWith({
      farmId: 7,
      body: expect.objectContaining({
        clientId: null,
        paymentMethod: 'CASH',
        lines: [
          expect.objectContaining({
            articleKey: 'BROILER',
            articleSource: 'PRODUCTION',
            productType: 'BROILER',
            productionUnitId: 5,
            quantity: 1,
          }),
        ],
      }),
    });
  });

  it('bascule en mode au poids, pré-remplit le poids et envoie weightKg', async () => {
    await render(<VenteScreen />);
    await press(screen.getByLabelText('Ajouter Lot A à la vente'));
    await press(screen.getByLabelText('Au poids — Lot A'));

    const weightInput = await screen.findByLabelText('Poids total (kg) — Lot A');
    await fireEvent.changeText(weightInput, '30.5');

    await press(screen.getByLabelText('Valider la vente'));

    expect(mockCreateSale).toHaveBeenCalledWith({
      farmId: 7,
      body: expect.objectContaining({
        lines: [expect.objectContaining({ weightKg: 30.5, quantity: 1 })],
      }),
    });
  });
});
