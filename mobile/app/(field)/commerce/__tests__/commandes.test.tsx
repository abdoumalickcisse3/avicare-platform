import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), back: jest.fn() })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
jest.mock('@/store/api/clientsApi', () => ({
  useGetClientsQuery: jest.fn(() => ({ data: [{ id: 3, displayName: 'Awa Diop' }] })),
}));
jest.mock('@/store/api/ordersApi', () => ({
  useGetOrdersQuery: jest.fn(() => ({
    data: [
      { id: 5, farmId: 7, orderNumber: 'C-001', clientId: 3, status: 'PENDING', orderDate: '2026-08-01', expectedDeliveryDate: '2026-08-05', actualDeliveryDate: null, expectedPaymentMethod: null, totalXof: 24000, notes: null, items: [] },
    ],
    isLoading: false,
  })),
}));

import CommandesScreen from '../commandes';

describe('Commandes list', () => {
  it('lists orders with number, client and total', async () => {
    await render(<CommandesScreen />);
    expect(screen.getByText('C-001')).toBeTruthy();
    expect(screen.getByText('Awa Diop')).toBeTruthy();
  });
});
