import { render, screen } from '@testing-library/react-native';

const alerts = {
  lowStockItems: [],
  negativeStockItems: [
    { stockItemId: 3, articleKey: 'corn_crushed', label: 'Maïs concassé', currentQuantity: -12, unit: 'kg' },
  ],
  pendingPurchaseOrders: [
    {
      purchaseOrderId: 9,
      orderNumber: 'BA-2026-004',
      supplierId: 2,
      supplierName: 'Provendier du Sahel',
      expectedDeliveryDate: '2026-08-28',
      daysOverdue: 6,
      totalXof: 180000,
    },
  ],
  recentMovements: [],
};

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/auth/useSession', () => ({
  useFarmAccess: jest.fn(() => ({ farmRole: 'OWNER', can: () => true, isAdmin: true, session: null })),
}));
jest.mock('@/store/api/inventoryStockApi', () => ({
  useGetStockItemsQuery: jest.fn(() => ({ data: [], isLoading: false })),
  useGetLowStockItemsQuery: jest.fn(() => ({ data: [] })),
  useGetStockValuationQuery: jest.fn(() => ({ data: { totalValueXof: 250000 } })),
  useGetInventoryAlertsQuery: jest.fn(() => ({ data: alerts })),
}));

import StocksScreen from '../stocks';

describe('Stocks tab', () => {
  it('regroupe les alertes de tous types dans une seule section', async () => {
    await render(<StocksScreen />);

    expect(screen.getByText('Alertes (2)')).toBeTruthy();
    expect(screen.getByText('Maïs concassé')).toBeTruthy();
    expect(screen.getByText(/BA-2026-004/)).toBeTruthy();
    expect(screen.getByText(/6 j de retard/)).toBeTruthy();
  });

  it('affiche le nombre d\'alertes dans la bande ticket, en orange', async () => {
    await render(<StocksScreen />);
    expect(screen.getByText('2')).toBeTruthy();
  });
});
