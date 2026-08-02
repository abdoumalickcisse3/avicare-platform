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
jest.mock('@/auth/useSession', () => ({
  useFarmAccess: jest.fn(() => ({ farmRole: 'OWNER', can: () => true, isAdmin: true, session: null })),
}));
jest.mock('@/store/api/clientsApi', () => ({
  useGetClientsQuery: jest.fn(() => ({ data: [{ id: 3, displayName: 'Awa Diop' }] })),
}));
jest.mock('@/store/api/salesApi', () => ({
  useGetSalesQuery: jest.fn(() => ({
    data: [
      {
        id: 1,
        saleNumber: 'V-001',
        clientId: 3,
        status: 'COMPLETED',
        saleDate: '2026-08-01',
        paymentMethod: 'CASH',
        salesChannelKey: null,
        totalXof: 3500,
        notes: null,
        items: [{ id: 1, quantity: 2, articleLabelSnapshot: 'Poulet', articleKey: 'BROILER', unit: 'tête', articleSource: 'PRODUCTION', unitPriceXof: 1750, lineTotalXof: 3500, notes: null }],
      },
    ],
    isLoading: false,
  })),
  useCancelSaleMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
}));

import VentesScreen from '../ventes';

describe('Ventes list', () => {
  it('lists sales with number, client and total', async () => {
    await render(<VentesScreen />);
    expect(screen.getByText('V-001')).toBeTruthy();
    expect(screen.getByText('Awa Diop')).toBeTruthy();
    expect(screen.getByLabelText('Nouvelle vente')).toBeTruthy();
  });
});
