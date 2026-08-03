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

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ back: jest.fn(), replace: jest.fn() })),
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
  useCreatePurchaseOrderMutation: jest.fn(() => [mockCreate, { isLoading: false }]),
}));

import AchatNouveauScreen from '../achat-nouveau';

describe('Nouveau bon d\'achat', () => {
  beforeEach(() => mockCreate.mockClear());

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
});
