import { act, fireEvent, render, screen } from '@testing-library/react-native';

// React 19 + RNTL 14: fireEvent schedules a state update that isn't flushed by
// the time it returns, so gestures are wrapped in an async act (see the
// established pattern in `lots/[unitId]/__tests__/mortalite.test.tsx`).
const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const type = (el: Parameters<typeof fireEvent.changeText>[0], text: string): Promise<void> =>
  act(async () => {
    fireEvent.changeText(el, text);
  });

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: '3' })),
  useRouter: jest.fn(() => ({ back: jest.fn() })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));

const farmAccess = { farmRole: 'OWNER', can: () => true, isAdmin: true, session: null };
jest.mock('@/auth/useSession', () => ({
  useFarmAccess: jest.fn(() => farmAccess),
}));

const SUPPLIER = { id: 3, commercialName: 'Provende du Sahel', phone: '77 000 00 00', notifyWhatsapp: true };
jest.mock('@/store/api/suppliersApi', () => ({
  useGetSupplierQuery: jest.fn(() => ({ data: SUPPLIER })),
}));

const STATEMENT = {
  supplierId: 3,
  balanceXof: 300000,
  entries: [
    {
      id: 1,
      entryDate: '2026-09-01',
      direction: 'DEBIT',
      source: 'PURCHASE_ORDER',
      amountXof: 500000,
      label: "Bon d'achat BA-12",
      method: null,
      reference: null,
      purchaseOrderId: 88,
      runningBalanceXof: 500000,
    },
    {
      id: 2,
      entryDate: '2026-09-03',
      direction: 'CREDIT',
      source: 'MANUAL',
      amountXof: 200000,
      label: 'Versement',
      method: 'CASH',
      reference: null,
      purchaseOrderId: null,
      runningBalanceXof: 300000,
    },
  ],
};

interface RecordPaymentArgs {
  farmId: number;
  supplierId: number;
  body: Record<string, unknown>;
}
const mockRecordPayment = jest.fn((_args: RecordPaymentArgs) => ({ unwrap: () => Promise.resolve(9) }));
jest.mock('@/store/api/supplierLedgerApi', () => ({
  useGetSupplierLedgerQuery: jest.fn(() => ({ data: STATEMENT, isLoading: false })),
  useRecordSupplierPaymentMutation: jest.fn(() => [mockRecordPayment, { isLoading: false }]),
}));

import FournisseurDetailScreen from '../[id]';

describe('Fournisseur detail (compte-courant)', () => {
  beforeEach(() => {
    farmAccess.farmRole = 'OWNER';
    mockRecordPayment.mockClear();
  });

  it('affiche le solde et le relevé', async () => {
    await render(<FournisseurDetailScreen />);
    expect(screen.getByText('Vous devez 300 000 F')).toBeTruthy();
    expect(screen.getByText("Bon d'achat BA-12")).toBeTruthy();
    expect(screen.getByText('Versement')).toBeTruthy();
  });

  it('enregistre un paiement en ligne, avec le motif WhatsApp explicite', async () => {
    await render(<FournisseurDetailScreen />);

    await press(screen.getByLabelText('Enregistrer un paiement'));
    await type(await screen.findByLabelText('Montant'), '100000');
    await press(screen.getByLabelText('Confirmer le paiement'));

    expect(mockRecordPayment).toHaveBeenCalledTimes(1);
    const call = mockRecordPayment.mock.calls[0]![0];
    expect(call.farmId).toBe(7);
    expect(call.supplierId).toBe(3);
    expect(call.body.amountXof).toBe(100000);
    expect(call.body.notifySupplier).toBe(true);
  });

  it("cache l'action à un membre qui n'est ni propriétaire ni gérant", async () => {
    farmAccess.farmRole = 'FARMER';
    await render(<FournisseurDetailScreen />);

    expect(screen.getByText("Bon d'achat BA-12")).toBeTruthy();
    expect(screen.queryByLabelText('Enregistrer un paiement')).toBeNull();
  });
});
