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
  useRouter: jest.fn(() => ({ back: jest.fn(), push: jest.fn() })),
  useLocalSearchParams: jest.fn(() => ({ id: '2' })),
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
jest.mock('@/store/api/suppliersApi', () => ({
  useGetSupplierQuery: jest.fn(() => ({
    data: { id: 2, commercialName: 'Sénégal Aliments', phone: '771234567', notifyWhatsapp: true, types: [] },
  })),
  useUpdateSupplierMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
  useDeleteSupplierMutation: jest.fn(() => [mockDeleteSupplier, { isLoading: false }]),
}));
const mockDeleteSupplier = jest.fn(() => ({ unwrap: () => Promise.resolve() }));
const mockRecordCharge = jest.fn(() => ({ unwrap: () => Promise.resolve(1) }));
const mockDeleteEntry = jest.fn(() => ({ unwrap: () => Promise.resolve() }));
const mockLedger: { result: unknown } = {
  result: {
    data: {
      supplierId: 2,
      balanceXof: 15000,
      entries: [
        { id: 10, entryDate: '2026-09-01', direction: 'DEBIT', source: 'MANUAL', amountXof: 20000, label: 'Carnet boutique', method: null, reference: null, purchaseOrderId: null, runningBalanceXof: 20000 },
        { id: 11, entryDate: '2026-09-03', direction: 'DEBIT', source: 'PURCHASE_ORDER', amountXof: 5000, label: 'BA-2026-004', method: null, reference: null, purchaseOrderId: 4, runningBalanceXof: 25000 },
      ],
    },
    isLoading: false,
  },
};
jest.mock('@/store/api/supplierLedgerApi', () => ({
  useGetSupplierLedgerQuery: jest.fn(() => mockLedger.result),
  useRecordSupplierPaymentMutation: jest.fn(() => [jest.fn(() => ({ unwrap: () => Promise.resolve(1) })), { isLoading: false }]),
  useRecordSupplierChargeMutation: jest.fn(() => [mockRecordCharge, { isLoading: false }]),
  useDeleteLedgerEntryMutation: jest.fn(() => [mockDeleteEntry, { isLoading: false }]),
}));

import FournisseurDetailScreen from '../fournisseurs/[id]';

const healthyLedger = () => ({
  data: {
    supplierId: 2,
    balanceXof: 15000,
    entries: [
      { id: 10, entryDate: '2026-09-01', direction: 'DEBIT', source: 'MANUAL', amountXof: 20000, label: 'Carnet boutique', method: null, reference: null, purchaseOrderId: null, runningBalanceXof: 20000 },
      { id: 11, entryDate: '2026-09-03', direction: 'DEBIT', source: 'PURCHASE_ORDER', amountXof: 5000, label: 'BA-2026-004', method: null, reference: null, purchaseOrderId: 4, runningBalanceXof: 25000 },
    ],
  },
  isLoading: false,
});

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
  mockLedger.result = healthyLedger();
  mockRecordCharge.mockClear();
  mockDeleteEntry.mockClear();
  mockDeleteSupplier.mockClear();
});

describe('Fournisseur — compte-courant', () => {
  it('records a debt without a payment method and without a WhatsApp notice', async () => {
    // A DEBIT is what we owe him; there is nothing for the supplier to acknowledge in it.
    await render(<FournisseurDetailScreen />);
    await press(screen.getByLabelText('Ajouter une dette'));

    expect(screen.getByText(/le carnet de la boutique/)).toBeTruthy();
    expect(screen.queryByText('Mode de paiement')).toBeNull();
    expect(screen.queryByLabelText('Prévenir Sénégal Aliments par WhatsApp')).toBeNull();

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Montant'), '12000');
    });
    await press(screen.getByLabelText('Confirmer la dette'));

    expect(mockRecordCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        farmId: 7,
        supplierId: 2,
        body: expect.objectContaining({ amountXof: 12000 }),
      }),
    );
    expect(mockRecordCharge.mock.calls[0][0].body).not.toHaveProperty('method');
  });

  it('removes a manual line only, never one derived from a purchase order', async () => {
    await render(<FournisseurDetailScreen />);

    expect(screen.getByLabelText('Supprimer la ligne du 2026-09-01')).toBeTruthy();
    expect(screen.queryByLabelText('Supprimer la ligne du 2026-09-03')).toBeNull();

    await press(screen.getByLabelText('Supprimer la ligne du 2026-09-01'));
    await confirmAlert('Supprimer');

    expect(mockDeleteEntry).toHaveBeenCalledWith({ farmId: 7, supplierId: 2, entryId: 10 });
  });

  it('says the debt survives when retiring a supplier', async () => {
    // Deactivation is a soft delete: the balance keeps counting in the farm total (PR #312).
    await render(<FournisseurDetailScreen />);
    await press(screen.getByLabelText('Retirer ce fournisseur'));

    const [title, message] = (Alert.alert as unknown as jest.Mock).mock.calls.at(-1) as string[];
    expect(title).toBe('Retirer ce fournisseur ?');
    expect(message).toMatch(/reste compté dans votre dette fournisseurs/);

    await confirmAlert('Retirer');
    expect(mockDeleteSupplier).toHaveBeenCalledWith({ farmId: 7, id: 2 });
  });

  it('does not read as a settled account when the statement fails to load', async () => {
    mockLedger.result = { data: undefined, isLoading: false, error: { status: 403 } };
    await render(<FournisseurDetailScreen />);

    expect(screen.getByText('Solde indisponible')).toBeTruthy();
    expect(screen.queryByText('Compte soldé')).toBeNull();
  });
});
