import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const mockCreateOrder = jest.fn(() => ({ unwrap: () => Promise.resolve({ id: 1 }) }));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ back: jest.fn(), replace: jest.fn() })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
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
jest.mock('@/store/api/clientsApi', () => ({
  useGetClientsQuery: jest.fn(() => ({ data: [{ id: 3, displayName: 'Awa Diop' }] })),
}));
jest.mock('@/store/api/ordersApi', () => ({
  useCreateOrderMutation: jest.fn(() => [mockCreateOrder, { isLoading: false }]),
}));

import CommandeNouvelleScreen from '../commande-nouvelle';

describe('Créer une commande', () => {
  beforeEach(() => mockCreateOrder.mockClear());

  it('requires a client, then creates the order with lines', async () => {
    await render(<CommandeNouvelleScreen />);
    await press(screen.getByLabelText('Ajouter Lot A à la commande'));
    await press(screen.getByLabelText('Choisir le client'));
    await press(screen.getByLabelText('Awa Diop'));
    await press(screen.getByLabelText('Valider la commande'));
    expect(mockCreateOrder).toHaveBeenCalledWith({
      farmId: 7,
      body: expect.objectContaining({
        clientId: 3,
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
