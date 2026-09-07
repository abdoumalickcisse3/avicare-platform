import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

/** Runs the button of a confirmation Alert by its label. */
async function confirmAlert(label: string) {
  const spy = Alert.alert as unknown as jest.Mock;
  const buttons = spy.mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[];
  const button = buttons.find((b) => b.text === label);
  if (!button?.onPress) throw new Error(`No "${label}" button in the last Alert`);
  await act(async () => {
    button.onPress?.();
  });
}

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: '5' })),
  useRouter: jest.fn(() => ({ back: jest.fn() })),
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
const mockOrder: { status: string } = { status: 'PENDING' };
jest.mock('@/store/api/ordersApi', () => ({
  useGetOrderQuery: jest.fn(() => ({
    data: {
      id: 5, farmId: 7, orderNumber: 'C-001', clientId: 3, status: mockOrder.status, orderDate: '2026-08-01',
      expectedDeliveryDate: '2026-08-05', actualDeliveryDate: null, expectedPaymentMethod: null, totalXof: 24000, notes: null,
      items: [{ id: 1, articleKey: 'BROILER', articleSource: 'PRODUCTION', articleLabelSnapshot: 'Poulet', unit: 'tête', quantity: 12, unitPriceXof: 2000, lineTotalXof: 24000, notes: null }],
    },
    isLoading: false,
  })),
  useConfirmOrderMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
  useStartOrderPreparationMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
  useCancelOrderMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
}));
const mockCancelDelivery = jest.fn((_arg: { farmId: number; id: number }) => ({
  unwrap: () => Promise.resolve({}),
}));
const mockDeliveries: { result: unknown } = { result: { data: [] } };
jest.mock('@/store/api/deliveriesApi', () => ({
  useCreateDeliveryFromOrderMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
  useGetDeliveriesQuery: jest.fn(() => mockDeliveries.result),
  useCancelDeliveryMutation: jest.fn(() => [mockCancelDelivery, { isLoading: false }]),
}));

import CommandeDetailScreen from '../[id]';

const DELIVERED = {
  id: 9, farmId: 7, deliveryNumber: 'LIV-2026-003', orderId: 5, clientId: 3,
  status: 'DELIVERED', deliveryDate: '2026-08-06', totalXof: 24000,
};

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
  mockOrder.status = 'PENDING';
  mockDeliveries.result = { data: [] };
  mockCancelDelivery.mockClear();
});

describe('Commande detail', () => {
  it('shows the order and a Confirmer action for a PENDING order (OWNER)', async () => {
    await render(<CommandeDetailScreen />);
    expect(screen.getByText('C-001')).toBeTruthy();
    expect(screen.getByText('Awa Diop')).toBeTruthy();
    expect(screen.getByLabelText('Confirmer la commande')).toBeTruthy();
  });

  it('shows the delivery once the order is delivered, and says what cancelling it does', async () => {
    // The phone has no deliveries screen: without this, a delivery recorded by mistake could
    // only be undone from a desktop.
    mockOrder.status = 'DELIVERED';
    mockDeliveries.result = { data: [DELIVERED] };
    await render(<CommandeDetailScreen />);

    expect(screen.getByText('LIV-2026-003')).toBeTruthy();
    await press(screen.getByLabelText('Annuler la livraison'));

    const [title, message] = (Alert.alert as unknown as jest.Mock).mock.calls.at(-1) as string[];
    expect(title).toBe('Annuler la livraison ?');
    expect(message).toMatch(/le stock est réintégré/);

    await confirmAlert('Annuler la livraison');
    expect(mockCancelDelivery).toHaveBeenCalledWith({ farmId: 7, id: 9 });
  });

  it('offers nothing on a delivery that is already cancelled', async () => {
    // The backend answers INVALID_DELIVERY_TRANSITION on anything but a DELIVERED one.
    mockOrder.status = 'DELIVERED';
    mockDeliveries.result = { data: [{ ...DELIVERED, status: 'CANCELLED' }] };
    await render(<CommandeDetailScreen />);

    expect(screen.queryByLabelText('Annuler la livraison')).toBeNull();
  });
});
