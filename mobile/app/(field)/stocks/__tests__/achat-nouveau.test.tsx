import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });
const type = (el: Parameters<typeof fireEvent.changeText>[0], t: string): Promise<void> =>
  act(async () => {
    fireEvent.changeText(el, t);
  });

const mockCreate = jest.fn(() => ({ unwrap: () => Promise.resolve({ id: 1 }) }));

// Sans `?id=`, l'écran crée ; avec, il corrige ce brouillon.
const mockParams: { id?: string } = {};
const mockExisting: { value: unknown } = { value: undefined };
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ back: jest.fn(), replace: jest.fn() })),
  useLocalSearchParams: jest.fn(() => mockParams),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('@/auth/useSession', () => ({
  useFarmAccess: jest.fn(() => ({ farmRole: 'OWNER', can: () => true, isAdmin: true, session: null })),
}));
jest.mock('@/store/api/suppliersApi', () => ({
  useGetSuppliersQuery: jest.fn(() => ({ data: [{ id: 2, commercialName: 'Sénégal Aliments' }] })),
}));
jest.mock('@/store/api/inventoryStockApi', () => ({
  useGetStockItemsQuery: jest.fn(() => ({
    data: [{ id: 9, farmId: 7, articleKey: 'feed_starter', articleSource: 'INVENTORY', currentQuantity: 100, unit: 'kg', alertThreshold: null, typicalUnitPriceXof: 300, lastMovementAt: null, active: true, notes: null }],
  })),
}));
jest.mock('@/store/api/purchaseOrdersApi', () => ({
  useGetPurchaseOrderQuery: jest.fn(() => ({ data: mockExisting.value })),
  useUpdatePurchaseOrderMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
  useCreatePurchaseOrderMutation: jest.fn(() => [mockCreate, { isLoading: false }]),
}));

import AchatNouveauScreen from '../achat-nouveau';

describe('Nouveau bon d\'achat', () => {
  beforeEach(() => {
    mockCreate.mockClear();
    // Les deux fixtures sont partagées : les remettre à zéro évite qu'un test en ouvre un autre
    // en mode correction sans le vouloir.
    delete mockParams.id;
    mockExisting.value = undefined;
  });

  it('picks a supplier + an article, then creates the order', async () => {
    await render(<AchatNouveauScreen />);
    await press(screen.getByLabelText('Choisir le fournisseur'));
    await press(screen.getByLabelText('Sénégal Aliments'));
    await press(screen.getByLabelText('Ajouter Feed starter'));
    await type(screen.getByLabelText('Quantité Feed starter'), '500');
    await press(screen.getByLabelText('Valider le bon d\'achat'));
    expect(mockCreate).toHaveBeenCalledWith({
      farmId: 7,
      body: expect.objectContaining({
        supplierId: 2,
        lines: [expect.objectContaining({ articleKey: 'feed_starter', articleSource: 'INVENTORY', orderedQuantity: 500 })],
      }),
    });
  });

  it('recharge un brouillon quand on vient le corriger', async () => {
    // Le brouillon existe pour être revu : l'écran doit rouvrir CE bon, pas un formulaire vide.
    mockParams.id = '4';
    mockExisting.value = {
      id: 4, farmId: 7, orderNumber: 'BA-001', supplierId: 2, supplierName: 'Sénégal Aliments',
      status: 'DRAFT', orderDate: '2026-08-01', expectedDeliveryDate: '2026-08-05',
      actualDeliveryDate: null, totalXof: 150000, notes: null,
      items: [{ id: 11, articleKey: 'FEED_STARTER', articleSource: 'INVENTORY', articleLabelSnapshot: 'Aliment démarrage', unit: 'kg', orderedQuantity: 500, receivedQuantity: 0, unitPriceXof: 300, lineTotalXof: 150000, notes: null }],
    };

    await render(<AchatNouveauScreen />);

    expect(screen.getByText('Corriger le brouillon')).toBeTruthy();
    // La ligne du brouillon est là, avec sa quantité — pas un formulaire vide.
    expect(screen.getByText('Aliment démarrage')).toBeTruthy();
  });
});
