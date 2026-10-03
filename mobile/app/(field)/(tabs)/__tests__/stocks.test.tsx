import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { StockItem } from '@/types';

const lowItem: StockItem = {
  id: 5,
  farmId: 7,
  articleKey: 'feed_layer',
  label: 'Aliment ponte',
  articleSource: 'INVENTORY',
  currentQuantity: 12,
  unit: 'kg',
  alertThreshold: 20,
  typicalUnitPriceXof: null,
  lastMovementAt: null,
  active: true,
  notes: null,
};

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
  useGetStockItemsQuery: jest.fn(() => ({ data: [lowItem], isLoading: false })),
  useGetLowStockItemsQuery: jest.fn(() => ({ data: [lowItem] })),
  useGetStockValuationQuery: jest.fn(() => ({ data: { totalValueXof: 250000 } })),
  useGetInventoryAlertsQuery: jest.fn(() => ({ data: alerts })),
}));

import StocksScreen from '../stocks';

describe('Stocks tab', () => {
  it('regroupe les alertes de tous types dans une seule section', async () => {
    await render(<StocksScreen />);

    expect(screen.getByText('Alertes (3)')).toBeTruthy();
    expect(screen.getByText('Maïs concassé')).toBeTruthy();
    expect(screen.getAllByText('Aliment ponte').length).toBeGreaterThan(0);
    expect(screen.getByText(/BA-2026-004/)).toBeTruthy();
    expect(screen.getByText(/6 j de retard/)).toBeTruthy();
    expect(screen.getByText(/Un compte sous zéro n'est pas une rupture/)).toBeTruthy();
  });

  it("nomme l'article avec son libellé de catalogue, pas avec sa clé technique", async () => {
    await render(<StocksScreen />);

    // Les articles configurés à l'inscription arrivent à 0 : affichés par leur clé, la vue
    // d'ensemble se lisait « Feed layer », « Feed starter broiler »…
    expect(screen.getAllByText('Aliment ponte').length).toBeGreaterThan(0);
    expect(screen.queryByText('Feed layer')).toBeNull();
  });

  it('retombe sur la clé humanisée quand le catalogue ne connaît plus l’article', async () => {
    const { useGetStockItemsQuery } = jest.requireMock('@/store/api/inventoryStockApi');
    const asDeclared = useGetStockItemsQuery.getMockImplementation();
    useGetStockItemsQuery.mockImplementation(() => ({
      data: [{ ...lowItem, label: null }],
      isLoading: false,
    }));
    try {
      await render(<StocksScreen />);

      expect(screen.getAllByText('Feed layer').length).toBeGreaterThan(0);
    } finally {
      useGetStockItemsQuery.mockImplementation(asDeclared);
    }
  });

  it('cherche sur le libellé affiché, pas seulement sur la clé technique', async () => {
    await render(<StocksScreen />);
    const search = screen.getByPlaceholderText('Rechercher un article…');

    // « Aliment ponte » apparaît deux fois quand la ligne survit au filtre : dans Alertes (jamais
    // filtré) et dans la liste. Une seule fois ⇒ la liste l'a écartée.
    await act(async () => fireEvent.changeText(search, 'ponte'));
    expect(screen.getAllByText('Aliment ponte')).toHaveLength(2);

    await act(async () => fireEvent.changeText(search, 'zzz'));
    expect(screen.getAllByText('Aliment ponte')).toHaveLength(1);
  });

  it("affiche le nombre d'alertes dans la bande ticket, en orange", async () => {
    await render(<StocksScreen />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('teinte le stock négatif en rouge (fait déjà mauvais), distinct du stock bas et du retard', async () => {
    await render(<StocksScreen />);

    // Negative stock: already-bad fact — error red.
    expect(screen.getByText('-12 kg').props.style).toContainEqual(
      expect.objectContaining({ color: '#DC2626' }),
    );
  });

  it('teinte le stock bas et la commande en retard en orange (action), pas en ambre ni en bleu', async () => {
    await render(<StocksScreen />);

    // "12 kg" appears twice: the Alertes row and the article's own row below it. Low stock and
    // an overdue order both need an action — same accent orange as the band count, not the old
    // amber (low) / blue (overdue) split, and not the red reserved for an already-bad fact.
    const lowStockMentions = screen.getAllByText('12 kg');
    expect(lowStockMentions).toHaveLength(2);
    for (const el of lowStockMentions) {
      expect(el.props.style).toContainEqual(expect.objectContaining({ color: '#F8961E' }));
      expect(el.props.style).not.toContainEqual(expect.objectContaining({ color: '#DC2626' }));
    }

    expect(screen.getByText(/6 j de retard/).props.style).toContainEqual(
      expect.objectContaining({ color: '#F8961E' }),
    );
  });
});
