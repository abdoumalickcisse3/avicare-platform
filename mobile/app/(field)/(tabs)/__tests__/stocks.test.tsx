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
  it('surfaces a negative count as a bookkeeping error, not a shortage', async () => {
    // A count below zero cannot be restocked away: an exit was recorded twice, or an entry never
    // recorded, and every figure derived from that article is wrong until someone corrects it.
    await render(<StocksScreen />);

    expect(screen.getByText(/Stock négatif — 1/)).toBeTruthy();
    expect(screen.getByText('Maïs concassé')).toBeTruthy();
    expect(screen.getByText(/sortie enregistrée/i)).toBeTruthy();
  });

  it('shows the orders that never arrived', async () => {
    await render(<StocksScreen />);

    expect(screen.getByText(/Commandes en retard — 1/)).toBeTruthy();
    expect(screen.getByText(/BA-2026-004 · Provendier du Sahel/)).toBeTruthy();
    expect(screen.getByText('6 j de retard')).toBeTruthy();
  });
});
