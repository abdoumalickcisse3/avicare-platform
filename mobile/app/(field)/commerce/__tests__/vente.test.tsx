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
  useRouter: jest.fn(() => ({ back: jest.fn(), push: jest.fn() })),
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
});
