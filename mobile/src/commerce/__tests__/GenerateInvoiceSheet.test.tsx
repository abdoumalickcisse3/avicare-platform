import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const mockFromSale = jest.fn(() => ({ unwrap: () => Promise.resolve({ id: 1 }) }));
const mockFromDelivery = jest.fn(() => ({ unwrap: () => Promise.resolve({ id: 1 }) }));

const mockInvoices: { data: unknown[] } = { data: [] };
jest.mock('@/store/api/invoicesApi', () => ({
  useGetInvoicesQuery: jest.fn(() => ({ data: mockInvoices.data })),
  useCreateInvoiceFromSaleMutation: jest.fn(() => [mockFromSale, { isLoading: false }]),
  useCreateInvoiceFromDeliveryMutation: jest.fn(() => [mockFromDelivery, { isLoading: false }]),
}));
jest.mock('@/store/api/salesApi', () => ({
  useGetSalesQuery: jest.fn(() => ({
    data: [{ id: 5, saleNumber: 'V-005', status: 'COMPLETED', totalXof: 8000, clientId: 3, items: [] }],
  })),
}));
jest.mock('@/store/api/deliveriesApi', () => ({
  useGetDeliveriesQuery: jest.fn(() => ({ data: [] })),
}));

import { GenerateInvoiceSheet } from '@/commerce/GenerateInvoiceSheet';

describe('GenerateInvoiceSheet', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockFromSale.mockClear();
    mockFromDelivery.mockClear();
    mockInvoices.data = [];
  });
  afterEach(() => jest.restoreAllMocks());

  it('generates an invoice from an eligible completed sale', async () => {
    await render(<GenerateInvoiceSheet farmId={7} open onClose={jest.fn()} onDone={jest.fn()} />);
    await press(screen.getByLabelText('V-005'));
    await press(screen.getByLabelText('Générer la facture'));
    expect(mockFromSale).toHaveBeenCalledWith(expect.objectContaining({ farmId: 7, saleId: 5 }));
  });

  it('dit qu\'une vente est déjà facturée au lieu de la faire disparaître', async () => {
    // Elle sortait simplement de la liste : on ouvrait l'écran, on ne trouvait pas sa vente, et
    // rien ne disait pourquoi.
    mockInvoices.data = [
      { id: 1, invoiceNumber: 'F-2026-007', saleId: 5, deliveryId: null, status: 'ISSUED' },
    ];
    await render(<GenerateInvoiceSheet farmId={7} open onClose={jest.fn()} onDone={jest.fn()} />);

    expect(screen.getByText('V-005')).toBeTruthy();
    expect(screen.getByText(/Déjà facturée · F-2026-007/)).toBeTruthy();
    expect(screen.getByLabelText('V-005 — déjà facturée').props.accessibilityState.disabled).toBe(true);
  });

  it('rend la vente à nouveau facturable quand sa facture est annulée', async () => {
    // V56 : une facture annulée ne retient plus sa source. Le front ne comptait pas le statut,
    // donc la vente restait bloquée à l'écran même une fois libérée côté serveur.
    mockInvoices.data = [
      { id: 1, invoiceNumber: 'F-2026-007', saleId: 5, deliveryId: null, status: 'CANCELLED' },
    ];
    await render(<GenerateInvoiceSheet farmId={7} open onClose={jest.fn()} onDone={jest.fn()} />);

    expect(screen.queryByText(/Déjà facturée/)).toBeNull();
    await press(screen.getByLabelText('V-005'));
    await press(screen.getByLabelText('Générer la facture'));
    expect(mockFromSale).toHaveBeenCalled();
  });

  it('affiche la raison du refus, pas « Réessayez »', async () => {
    // « Réessayez » est un mauvais conseil sur une règle métier : aucun essai ne la changera.
    mockFromSale.mockImplementationOnce(() => ({
      unwrap: () =>
        Promise.reject({ status: 422, data: { detail: 'Sale V-005 is already invoiced' } }),
    }));
    await render(<GenerateInvoiceSheet farmId={7} open onClose={jest.fn()} onDone={jest.fn()} />);
    await press(screen.getByLabelText('V-005'));
    await press(screen.getByLabelText('Générer la facture'));

    const [, message] = (Alert.alert as unknown as jest.Mock).mock.calls.at(-1) as string[];
    expect(message).toBe('Sale V-005 is already invoiced');
  });
});
