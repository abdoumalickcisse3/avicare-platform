import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const toggleSwitch = (el: Parameters<typeof fireEvent>[0], value: boolean): Promise<void> =>
  act(async () => {
    fireEvent(el, 'valueChange', value);
  });

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

const SUPPLIER = {
  id: 3,
  commercialName: 'Provende du Sahel',
  contactPerson: 'Moussa Diop',
  phone: '77 000 00 00',
  email: 'contact@provende.sn',
  address: 'Zone industrielle',
  city: 'Thiès',
  types: ['FEED'],
  paymentTerms: '30J',
  notes: 'Livraison le mardi',
  active: true,
  notifyWhatsapp: true,
};
interface UpdateSupplierArgs {
  farmId: number;
  id: number;
  body: Record<string, unknown>;
}
const mockUpdateSupplier = jest.fn((_args: UpdateSupplierArgs) => ({ unwrap: () => Promise.resolve(SUPPLIER) }));
const mockDeleteSupplier = jest.fn((_args: { farmId: number; id: number }) => ({
  unwrap: () => Promise.resolve(),
}));
jest.mock('@/store/api/suppliersApi', () => ({
  useGetSupplierQuery: jest.fn(() => ({ data: SUPPLIER })),
  useUpdateSupplierMutation: jest.fn(() => [mockUpdateSupplier, { isLoading: false }]),
  useDeleteSupplierMutation: jest.fn(() => [mockDeleteSupplier, { isLoading: false }]),
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
const mockRecordCharge = jest.fn((_args: RecordPaymentArgs) => ({ unwrap: () => Promise.resolve(9) }));
const mockDeleteEntry = jest.fn(
  (_args: { farmId: number; supplierId: number; entryId: number }) => ({
    unwrap: () => Promise.resolve(),
  }),
);
const mockLedger: { result: unknown } = { result: { data: STATEMENT, isLoading: false } };
jest.mock('@/store/api/supplierLedgerApi', () => ({
  useGetSupplierLedgerQuery: jest.fn(() => mockLedger.result),
  useRecordSupplierPaymentMutation: jest.fn(() => [mockRecordPayment, { isLoading: false }]),
  useRecordSupplierChargeMutation: jest.fn(() => [mockRecordCharge, { isLoading: false }]),
  useDeleteLedgerEntryMutation: jest.fn(() => [mockDeleteEntry, { isLoading: false }]),
}));

import FournisseurDetailScreen from '../[id]';

describe('Fournisseur detail (compte-courant)', () => {
  beforeEach(() => {
    farmAccess.farmRole = 'OWNER';
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockRecordPayment.mockClear();
    mockUpdateSupplier.mockClear();
    mockRecordCharge.mockClear();
    mockDeleteEntry.mockClear();
    mockDeleteSupplier.mockClear();
    mockLedger.result = { data: STATEMENT, isLoading: false };
  });
  afterEach(() => jest.restoreAllMocks());

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
    expect(screen.queryByLabelText('Prévenir par WhatsApp')).toBeNull();
  });

  it('la case WhatsApp envoie le fournisseur complet, pas seulement le champ modifié', async () => {
    await render(<FournisseurDetailScreen />);

    await toggleSwitch(screen.getByLabelText('Prévenir par WhatsApp'), false);

    expect(mockUpdateSupplier).toHaveBeenCalledTimes(1);
    const call = mockUpdateSupplier.mock.calls[0]![0];
    expect(call.farmId).toBe(7);
    expect(call.id).toBe(3);
    expect(call.body).toEqual({
      commercialName: 'Provende du Sahel',
      contactPerson: 'Moussa Diop',
      phone: '77 000 00 00',
      email: 'contact@provende.sn',
      address: 'Zone industrielle',
      city: 'Thiès',
      types: ['FEED'],
      paymentTerms: '30J',
      notes: 'Livraison le mardi',
      // Only this field actually changed — the switch was on, this toggles it off.
      notifyWhatsapp: false,
    });
  });

  it('désactive la case WhatsApp et explique pourquoi sans téléphone renseigné', async () => {
    const original = SUPPLIER.phone;
    // @ts-expect-error mutating the shared fixture for this one test
    SUPPLIER.phone = null;
    try {
      await render(<FournisseurDetailScreen />);
      const toggle = screen.getByLabelText('Prévenir par WhatsApp');
      expect(toggle.props.accessibilityState?.disabled ?? toggle.props.disabled).toBe(true);
      expect(screen.getByText('Renseignez un téléphone pour activer les avis.')).toBeTruthy();
    } finally {
      SUPPLIER.phone = original;
    }
  });

  it('enregistre une dette sans mode de paiement ni avis WhatsApp', async () => {
    // Un DEBIT est ce qu'on lui doit : il n'y a rien à lui accuser réception.
    await render(<FournisseurDetailScreen />);
    await press(screen.getByLabelText('Ajouter une dette'));

    expect(screen.getByText(/le carnet de la boutique/)).toBeTruthy();
    expect(screen.queryByText('Mode de paiement')).toBeNull();
    expect(screen.queryByLabelText('Prévenir Provende du Sahel par WhatsApp')).toBeNull();

    await type(await screen.findByLabelText('Montant'), '12000');
    await press(screen.getByLabelText('Confirmer la dette'));

    expect(mockRecordCharge).toHaveBeenCalledTimes(1);
    const [chargeArg] = mockRecordCharge.mock.calls[0] ?? [];
    expect(chargeArg?.body.amountXof).toBe(12000);
    expect(chargeArg?.body).not.toHaveProperty('method');
    expect(mockRecordPayment).not.toHaveBeenCalled();
  });

  it("ne supprime qu'une ligne manuelle, jamais celle d'un bon d'achat", async () => {
    await render(<FournisseurDetailScreen />);

    expect(screen.getByLabelText('Supprimer la ligne du 2026-09-03')).toBeTruthy();
    expect(screen.queryByLabelText('Supprimer la ligne du 2026-09-01')).toBeNull();

    await press(screen.getByLabelText('Supprimer la ligne du 2026-09-03'));
    await confirmAlert('Supprimer');

    expect(mockDeleteEntry).toHaveBeenCalledWith({ farmId: 7, supplierId: 3, entryId: 2 });
  });

  it('dit que la dette survit au retrait du fournisseur', async () => {
    // Désactivation douce : le solde reste compté dans le total de la ferme (PR #312).
    await render(<FournisseurDetailScreen />);
    await press(screen.getByLabelText('Retirer ce fournisseur'));

    const [title, message] = (Alert.alert as unknown as jest.Mock).mock.calls.at(-1) as string[];
    expect(title).toBe('Retirer ce fournisseur ?');
    expect(message).toMatch(/reste compté dans votre dette fournisseurs/);

    await confirmAlert('Retirer');
    expect(mockDeleteSupplier).toHaveBeenCalledWith({ farmId: 7, id: 3 });
  });

  it("n'affiche pas « Compte soldé » quand le relevé ne charge pas", async () => {
    mockLedger.result = { data: undefined, isLoading: false, error: { status: 403 } };
    await render(<FournisseurDetailScreen />);

    expect(screen.getByText('Solde indisponible')).toBeTruthy();
    expect(screen.queryByText('Compte soldé')).toBeNull();
  });
});
