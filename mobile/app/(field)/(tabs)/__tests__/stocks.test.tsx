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

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: mockPush })),
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

/** Remplace une requête de l'API stock le temps d'un test, puis la remet comme déclarée. */
async function withStockApi(
  overrides: Record<string, unknown>,
  run: () => Promise<void>,
): Promise<void> {
  const api = jest.requireMock('@/store/api/inventoryStockApi');
  const saved = Object.fromEntries(
    Object.keys(overrides).map((k) => [k, api[k].getMockImplementation()]),
  );
  for (const [k, v] of Object.entries(overrides)) api[k].mockImplementation(() => v);
  try {
    await run();
  } finally {
    for (const k of Object.keys(overrides)) api[k].mockImplementation(saved[k]);
  }
}

const EMPTY_ALERTS = {
  lowStockItems: [],
  negativeStockItems: [],
  pendingPurchaseOrders: [],
  recentMovements: [],
};

describe('Stocks tab', () => {
  beforeEach(() => mockPush.mockClear());

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

  it('ouvre les quatre autres écrans du module stock', async () => {
    // Le web porte ces quatre entrées sous la liste ; sur mobile elles n'existaient que dans le
    // tiroir, donc un éleveur devant un stock vide n'avait aucun moyen de voir où sont ses
    // articles ni comment en faire entrer.
    await render(<StocksScreen />);

    for (const label of ['Bibliothèque', 'Fournisseurs', "Bons d'achat", 'Formules']) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }

    await act(async () => fireEvent.press(screen.getByLabelText('Bibliothèque')));
    expect(mockPush).toHaveBeenCalledWith('/(field)/stocks/bibliotheque');
  });

  it("n'envoie plus l'éleveur sur l'application web quand le stock est vide", async () => {
    await withStockApi(
      {
        useGetStockItemsQuery: { data: [], isLoading: false },
        useGetLowStockItemsQuery: { data: [] },
        useGetInventoryAlertsQuery: { data: EMPTY_ALERTS },
      },
      async () => {
        await render(<StocksScreen />);

        // Le mobile sait faire entrer du stock : un bon d'achat et une feuille de mouvement.
        expect(screen.queryByText(/application web/i)).toBeNull();
        await act(async () => fireEvent.press(screen.getByLabelText("Créer un bon d'achat")));
        expect(mockPush).toHaveBeenCalledWith('/(field)/stocks/achat-nouveau');
      },
    );
  });

  it('distingue une recherche sans résultat d’un stock vide', async () => {
    await render(<StocksScreen />);

    await act(async () =>
      fireEvent.changeText(screen.getByPlaceholderText('Rechercher un article…'), 'zzz'),
    );

    expect(screen.getByText(/Aucun article ne correspond/)).toBeTruthy();
    // Proposer de commander quelque chose n'a aucun sens ici : le stock n'est pas vide.
    expect(screen.queryByLabelText("Créer un bon d'achat")).toBeNull();
  });
});
