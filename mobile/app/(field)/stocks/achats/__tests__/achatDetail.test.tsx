import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const mockPo: { status: string } = { status: 'SENT' };

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: '4' })),
  useRouter: jest.fn(() => ({ back: jest.fn(), push: mockPush })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
const mockAccess = { farmRole: 'OWNER', can: () => true, isAdmin: false, session: null };
jest.mock('@/auth/useSession', () => ({ useFarmAccess: () => mockAccess }));
jest.mock('@/store/api/purchaseOrdersApi', () => ({
  useGetPurchaseOrderQuery: jest.fn(() => ({
    data: {
      id: 4, farmId: 7, orderNumber: 'BA-001', supplierId: 2, supplierName: 'Sénégal Aliments', status: mockPo.status,
      orderDate: '2026-08-01', expectedDeliveryDate: '2026-08-05', actualDeliveryDate: null, totalXof: 150000, notes: null,
      items: [{ id: 11, articleKey: 'FEED_STARTER', articleSource: 'INVENTORY', articleLabelSnapshot: 'Aliment démarrage', unit: 'kg', orderedQuantity: 500, receivedQuantity: 0, unitPriceXof: 300, lineTotalXof: 150000, notes: null }],
    },
    isLoading: false,
  })),
  useUpdatePurchaseOrderMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
  useSubmitPurchaseOrderMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
  useReceivePurchaseOrderMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
  useCancelPurchaseOrderMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
}));

import AchatDetailScreen from '../[id]';

beforeEach(() => {
  mockPo.status = 'SENT';
  mockAccess.farmRole = 'OWNER';
  mockAccess.isAdmin = false;
  mockPush.mockClear();
});

describe('Bon d\'achat detail', () => {
  it('shows a SENT order and a Réceptionner action', async () => {
    await render(<AchatDetailScreen />);
    expect(screen.getByText('BA-001')).toBeTruthy();
    expect(screen.getByText('Sénégal Aliments')).toBeTruthy();
    expect(screen.getByLabelText('Réceptionner le bon d\'achat')).toBeTruthy();
  });

  it('laisse corriger un brouillon plutôt que tout ressaisir', async () => {
    // Le backend réécrit un bon tant qu'il est DRAFT : sans ça, une quantité mal tapée
    // obligeait à annuler le bon et à le refaire ligne par ligne.
    mockPo.status = 'DRAFT';
    await render(<AchatDetailScreen />);

    await press(screen.getByLabelText('Corriger le brouillon'));
    expect(mockPush).toHaveBeenCalledWith('/(field)/stocks/achat-nouveau?id=4');
  });

  it('n\'offre pas de correction sur un bon déjà envoyé', async () => {
    await render(<AchatDetailScreen />);
    expect(screen.queryByLabelText('Corriger le brouillon')).toBeNull();
  });

  it('n\'offre aucune écriture à un ouvrier', async () => {
    // Le backend garde sur le RÔLE (`InventoryAccess.WRITE_MANAGER`), pas sur la permission :
    // `can` renvoie true ici, et pourtant le serveur refuserait.
    mockAccess.farmRole = 'FARMER';
    await render(<AchatDetailScreen />);

    expect(screen.getByText('BA-001')).toBeTruthy();
    expect(screen.queryByLabelText('Réceptionner le bon d\'achat')).toBeNull();
    expect(screen.queryByLabelText('Annuler le bon d\'achat')).toBeNull();
  });
});
