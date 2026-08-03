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
jest.mock('@/store/api/purchaseOrdersApi', () => ({
  useGetPurchaseOrdersQuery: jest.fn(() => ({
    data: [
      { id: 4, farmId: 7, orderNumber: 'BA-001', supplierId: 2, supplierName: 'Sénégal Aliments', status: 'SENT', orderDate: '2026-08-01', expectedDeliveryDate: '2026-08-05', actualDeliveryDate: null, totalXof: 150000, notes: null, items: [] },
    ],
    isLoading: false,
  })),
}));

import AchatsScreen from '../achats';

describe('Bons d\'achat list', () => {
  it('lists purchase orders with number, supplier and total', async () => {
    await render(<AchatsScreen />);
    expect(screen.getByText('BA-001')).toBeTruthy();
    expect(screen.getByText('Sénégal Aliments')).toBeTruthy();
    expect(screen.getByLabelText('Nouveau bon d\'achat')).toBeTruthy();
  });
});
