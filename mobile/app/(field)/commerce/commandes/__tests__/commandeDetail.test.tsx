import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: '5' })),
  useRouter: jest.fn(() => ({ back: jest.fn() })),
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
jest.mock('@/store/api/clientsApi', () => ({
  useGetClientsQuery: jest.fn(() => ({ data: [{ id: 3, displayName: 'Awa Diop' }] })),
}));
jest.mock('@/store/api/ordersApi', () => ({
  useGetOrderQuery: jest.fn(() => ({
    data: {
      id: 5, farmId: 7, orderNumber: 'C-001', clientId: 3, status: 'PENDING', orderDate: '2026-08-01',
      expectedDeliveryDate: '2026-08-05', actualDeliveryDate: null, expectedPaymentMethod: null, totalXof: 24000, notes: null,
      items: [{ id: 1, articleKey: 'BROILER', articleSource: 'PRODUCTION', articleLabelSnapshot: 'Poulet', unit: 'tête', quantity: 12, unitPriceXof: 2000, lineTotalXof: 24000, notes: null }],
    },
    isLoading: false,
  })),
  useConfirmOrderMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
  useStartOrderPreparationMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
  useCancelOrderMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
}));
jest.mock('@/store/api/deliveriesApi', () => ({
  useCreateDeliveryFromOrderMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
}));

import CommandeDetailScreen from '../[id]';

describe('Commande detail', () => {
  it('shows the order and a Confirmer action for a PENDING order (OWNER)', async () => {
    await render(<CommandeDetailScreen />);
    expect(screen.getByText('C-001')).toBeTruthy();
    expect(screen.getByText('Awa Diop')).toBeTruthy();
    expect(screen.getByLabelText('Confirmer la commande')).toBeTruthy();
  });
});
