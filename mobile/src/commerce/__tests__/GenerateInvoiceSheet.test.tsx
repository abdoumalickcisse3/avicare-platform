import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const mockFromSale = jest.fn(() => ({ unwrap: () => Promise.resolve({ id: 1 }) }));
const mockFromDelivery = jest.fn(() => ({ unwrap: () => Promise.resolve({ id: 1 }) }));

jest.mock('@/store/api/invoicesApi', () => ({
  useGetInvoicesQuery: jest.fn(() => ({ data: [] })),
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
    mockFromSale.mockClear();
    mockFromDelivery.mockClear();
  });

  it('generates an invoice from an eligible completed sale', async () => {
    await render(<GenerateInvoiceSheet farmId={7} open onClose={jest.fn()} onDone={jest.fn()} />);
    await press(screen.getByLabelText('V-005'));
    await press(screen.getByLabelText('Générer la facture'));
    expect(mockFromSale).toHaveBeenCalledWith(expect.objectContaining({ farmId: 7, saleId: 5 }));
  });
});
