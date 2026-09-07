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
  useLocalSearchParams: jest.fn(() => ({ id: '9' })),
  useRouter: jest.fn(() => ({ back: jest.fn() })),
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
// L'écran sort maintenant un PDF : nom de la ferme, moteur d'impression, feuille de partage.
jest.mock('@/store/api/farmsApi', () => ({
  useListFarmsQuery: jest.fn(() => ({ data: [{ id: 7, name: 'Ferme Complète' }] })),
}));
const mockPrintToFile = jest.fn(async (_a: { html: string }) => ({ uri: 'file:///tmp/f.pdf' }));
const mockPrintAsync = jest.fn(async (_a: { html: string }) => undefined);
jest.mock('expo-print', () => ({
  printToFileAsync: (a: { html: string }) => mockPrintToFile(a),
  printAsync: (a: { html: string }) => mockPrintAsync(a),
}));
const mockShareAvailable = { value: true };
const mockShare = jest.fn(async (_uri: string, _opts: unknown) => undefined);
jest.mock('expo-sharing', () => ({
  isAvailableAsync: async () => mockShareAvailable.value,
  shareAsync: (uri: string, opts: unknown) => mockShare(uri, opts),
}));
jest.mock('@/store/api/clientsApi', () => ({
  useGetClientsQuery: jest.fn(() => ({ data: [{ id: 3, displayName: 'Awa Diop' }] })),
}));
jest.mock('@/store/api/paymentsApi', () => ({
  useRecordPaymentMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
}));
const mockInvoice: { status: string; outstandingXof: number; amountPaidXof: number } = {
  status: 'ISSUED',
  outstandingXof: 12000,
  amountPaidXof: 0,
};
const mockCancelInvoice = jest.fn((_arg: { farmId: number; id: number }) => ({
  unwrap: () => Promise.resolve({}),
}));
jest.mock('@/store/api/invoicesApi', () => ({
  useCancelInvoiceMutation: jest.fn(() => [mockCancelInvoice, { isLoading: false }]),
  useGetInvoiceQuery: jest.fn(() => ({
    data: {
      id: 9, farmId: 7, invoiceNumber: 'F-001', clientId: 3, status: mockInvoice.status, issueDate: '2026-08-01', dueDate: null,
      totalXof: 12000, amountPaidXof: mockInvoice.amountPaidXof, outstandingXof: mockInvoice.outstandingXof,
      items: [{ id: 1, articleKey: 'BROILER', articleSource: 'PRODUCTION', articleLabelSnapshot: 'Poulet', unit: 'tête', quantity: 6, unitPriceXof: 2000, lineTotalXof: 12000 }],
    },
    isLoading: false,
  })),
}));

import FactureDetailScreen from '../[id]';

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
  mockShareAvailable.value = true;
  mockPrintToFile.mockClear();
  mockPrintAsync.mockClear();
  mockShare.mockClear();
  mockInvoice.status = 'ISSUED';
  mockInvoice.outstandingXof = 12000;
  mockInvoice.amountPaidXof = 0;
  mockCancelInvoice.mockClear();
});

describe('Facture detail', () => {
  it('shows the invoice, its amounts and an Encaisser action when unpaid (OWNER)', async () => {
    await render(<FactureDetailScreen />);
    expect(screen.getByText('F-001')).toBeTruthy();
    expect(screen.getByText('Awa Diop')).toBeTruthy();
    expect(screen.getByLabelText('Encaisser')).toBeTruthy();
  });

  it('names what the client stops owing before cancelling', async () => {
    // Cancelling removes the outstanding amount from the client's running account, so the
    // confirmation names it rather than just saying "annuler".
    await render(<FactureDetailScreen />);
    await press(screen.getByLabelText('Annuler la facture'));

    const [title, message] = (Alert.alert as unknown as jest.Mock).mock.calls.at(-1) as string[];
    expect(title).toBe('Annuler cette facture ?');
    expect(message).toMatch(/retirés du compte de Awa Diop/);

    await confirmAlert('Annuler la facture');
    expect(mockCancelInvoice).toHaveBeenCalledWith({ farmId: 7, id: 9 });
  });

  it('sort la facture en PDF et ouvre le partage', async () => {
    // Le web imprime depuis /factures/{id}/imprimer ; le mobile n'avait rien. Ici le fichier
    // existe sur l'appareil, donc l'éleveur peut l'envoyer à son client depuis WhatsApp.
    await render(<FactureDetailScreen />);
    await press(screen.getByLabelText('Imprimer ou partager la facture'));

    expect(mockPrintToFile).toHaveBeenCalled();
    const html = mockPrintToFile.mock.calls[0]?.[0]?.html ?? '';
    expect(html).toContain('F-001');
    expect(html).toContain('Ferme Complète');
    expect(html).toContain('Awa Diop');
    expect(mockShare).toHaveBeenCalledWith(
      'file:///tmp/f.pdf',
      expect.objectContaining({ mimeType: 'application/pdf' }),
    );
  });

  it('retombe sur la boîte d\'impression quand le partage est indisponible', async () => {
    // Émulateur nu, restrictions : la boîte système sait aussi enregistrer en PDF.
    mockShareAvailable.value = false;
    await render(<FactureDetailScreen />);
    await press(screen.getByLabelText('Imprimer ou partager la facture'));

    expect(mockShare).not.toHaveBeenCalled();
    expect(mockPrintAsync).toHaveBeenCalled();
  });

  it('offers no cancellation on a paid invoice', async () => {
    // The backend answers INVALID_INVOICE_TRANSITION on a PAID or already-CANCELLED one.
    mockInvoice.status = 'PAID';
    mockInvoice.outstandingXof = 0;
    mockInvoice.amountPaidXof = 12000;
    await render(<FactureDetailScreen />);

    expect(screen.queryByLabelText('Annuler la facture')).toBeNull();
  });
});
