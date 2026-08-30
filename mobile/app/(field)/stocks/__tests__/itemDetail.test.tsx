/**
 * The stock detail screen: the three questions it answers, in order.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { StockItem, StockMovement } from '@/types';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const mockItem: StockItem = {
  id: 5,
  farmId: 7,
  articleKey: 'feed_starter',
  articleSource: 'INVENTORY',
  currentQuantity: 45,
  unit: 'kg',
  alertThreshold: 50,
  typicalUnitPriceXof: 400,
  lastMovementAt: '2026-08-20T08:00:00',
  active: true,
  notes: null,
};

const movement = (over: Partial<StockMovement>): StockMovement => ({
  id: 1,
  stockItemId: 5,
  articleKey: 'feed_starter',
  movementType: 'OUT',
  movementDate: '2026-08-20',
  quantity: 30,
  quantityBefore: 75,
  quantityAfter: 45,
  reason: 'CONSUMPTION_LOT',
  productionUnitId: 3,
  purchaseOrderId: null,
  dailyRecordId: null,
  vaccinationId: null,
  treatmentExecutedId: null,
  unitPriceXof: null,
  totalValueXof: null,
  notes: null,
  ...over,
});

const mockMovements: StockMovement[] = [
  movement({ id: 1, dailyRecordId: 9 }),
  movement({
    id: 2,
    movementDate: '2026-07-02',
    movementType: 'IN',
    reason: 'RECEPTION_PURCHASE',
    quantity: 75,
    quantityBefore: 0,
    quantityAfter: 75,
    productionUnitId: null,
    purchaseOrderId: 12,
  }),
];

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ itemId: '5' }),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));

const mockAccess = { can: jest.fn(() => true), isAdmin: true, farmRole: 'OWNER', session: null };
jest.mock('@/auth/useSession', () => ({ useFarmAccess: () => mockAccess }));
jest.mock('@/inventory/StockMovementSheet', () => ({ StockMovementSheet: () => null }));

jest.mock('@/store/api/inventoryStockApi', () => ({
  useGetStockItemQuery: () => ({ data: mockItem, isLoading: false }),
  useGetMovementsByItemQuery: () => ({ data: mockMovements }),
  useUpdateStockThresholdMutation: () => [jest.fn(), { isLoading: false }],
  useDeactivateStockItemMutation: () => [jest.fn(), { isLoading: false }],
}));

// eslint-disable-next-line import/first
import StockItemScreen from '../[itemId]';

beforeEach(() => {
  mockAccess.can = jest.fn(() => true);
});

describe('StockItemScreen', () => {
  it('leads with the quantity and its unit, since that is the question being asked', async () => {
    await render(<StockItemScreen />);

    // The hero pairs the number with the unit in one node; "45" alone also appears in the ledger.
    expect(screen.getByText(' kg')).toBeTruthy();
    expect(screen.getByText(/Valeur ≈/)).toBeTruthy();
  });

  it('turns the quantity into a duration, which the web never does', async () => {
    // 30 kg out in the last 30 days = 1 kg/day; 45 kg left ≈ 45 days.
    jest.useFakeTimers().setSystemTime(new Date('2026-08-30T10:00:00Z'));
    await render(<StockItemScreen />);

    expect(screen.getByText(/45 jours de couverture/)).toBeTruthy();
    jest.useRealTimers();
  });

  it('names where each movement came from instead of printing an id column', async () => {
    await render(<StockItemScreen />);

    expect(screen.getByText('Saisie journalière')).toBeTruthy();
    expect(screen.getByText("Bon d'achat nº 12")).toBeTruthy();
  });

  it('shows the running balance, so the ledger reads without arithmetic', async () => {
    await render(<StockItemScreen />);

    expect(screen.getByText('reste 45')).toBeTruthy();
    expect(screen.getByText('reste 75')).toBeTruthy();
  });

  it('flags a stock under its threshold', async () => {
    await render(<StockItemScreen />);

    expect(screen.getByText('Sous le seuil')).toBeTruthy();
  });

  it('groups the ledger by month rather than dumping one long list', async () => {
    await render(<StockItemScreen />);

    expect(screen.getByText('août 2026')).toBeTruthy();
    expect(screen.getByText('juillet 2026')).toBeTruthy();
  });

  it('hides every write from a reader without inventory:write', async () => {
    mockAccess.can = jest.fn(() => false);

    await render(<StockItemScreen />);

    expect(screen.queryByLabelText('Enregistrer un mouvement')).toBeNull();
    expect(screen.queryByLabelText("Modifier le seuil d'alerte")).toBeNull();
    expect(screen.queryByLabelText('Archiver cet article')).toBeNull();
  });

  it('opens the threshold keypad on the threshold row', async () => {
    await render(<StockItemScreen />);

    await press(screen.getByLabelText("Modifier le seuil d'alerte"));

    expect(screen.getByLabelText('Seuil saisi')).toBeTruthy();
  });
});
