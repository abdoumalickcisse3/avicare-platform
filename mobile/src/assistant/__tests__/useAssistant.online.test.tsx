import { act, renderHook } from '@testing-library/react-native';

const mockInterpret = jest.fn();
const mockRecordPayment = jest.fn();
const mockCreateSale = jest.fn();
const mockCreatePurchaseOrder = jest.fn();
const mockEnqueue = jest.fn();

jest.mock('react-redux', () => ({
  useSelector: () => 7,
  useDispatch: () => jest.fn(),
  useStore: () => ({}),
}));
jest.mock('@/store/api/productionUnitsApi', () => ({ useListProductionUnitsQuery: () => ({ data: [] }) }));
jest.mock('@/store/api/assistantApi', () => ({ useInterpretMutation: () => [mockInterpret] }));
jest.mock('@/store/api/paymentsApi', () => ({ useRecordPaymentMutation: () => [mockRecordPayment] }));
jest.mock('@/store/api/salesApi', () => ({ useCreateSaleMutation: () => [mockCreateSale] }));
jest.mock('@/store/api/purchaseOrdersApi', () => ({ useCreatePurchaseOrderMutation: () => [mockCreatePurchaseOrder] }));
jest.mock('@/field/enqueueMutation', () => ({ enqueueFieldMutation: (...a: unknown[]) => mockEnqueue(...a) }));

import { useAssistant } from '@/assistant/useAssistant';

const ok = (value: unknown = {}) => ({ unwrap: () => Promise.resolve(value) });

const paymentDraft = {
  kind: 'DRAFT',
  action: 'RECORD_PAYMENT',
  unitId: null,
  fields: { invoiceId: 42, invoiceNumber: 'FAC-042', clientName: 'Diallo', amountXof: 30000, method: 'CASH' },
};

function driveDraft(fields: Record<string, unknown>, action: string, unitId: number | null = null) {
  mockInterpret.mockReturnValue({ unwrap: () => Promise.resolve({ kind: 'DRAFT', action, unitId, fields }) });
}

beforeEach(() => {
  mockInterpret.mockReturnValue({ unwrap: () => Promise.resolve(paymentDraft) });
  mockRecordPayment.mockReset();
  mockCreateSale.mockReset();
  mockCreatePurchaseOrder.mockReset();
  mockEnqueue.mockReset();
});

describe('useAssistant online confirm (payment)', () => {
  it('submits the payment mutation and reports success', async () => {
    const unwrap = jest.fn(() => Promise.resolve({}));
    mockRecordPayment.mockReturnValue({ unwrap });

    const { result } = await renderHook(() => useAssistant());
    await act(async () => {
      await result.current.submit('le client Diallo a payé 30000');
    });
    expect(result.current.draft?.title).toBe('Encaissement');

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.confirm();
    });

    expect(ok).toBe(true);
    expect(mockRecordPayment).toHaveBeenCalledWith({
      farmId: 7,
      body: { invoiceId: 42, amountXof: 30000, method: 'CASH' },
    });
    // Never touches the offline queue for an online action.
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(result.current.draft).toBeNull();
  });

  it('keeps the draft and surfaces a message on failure', async () => {
    mockRecordPayment.mockReturnValue({ unwrap: () => Promise.reject(new Error('422')) });

    const { result } = await renderHook(() => useAssistant());
    await act(async () => {
      await result.current.submit('le client Diallo a payé 30000');
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.confirm();
    });

    expect(ok).toBe(false);
    expect(result.current.draft).not.toBeNull();
    expect(result.current.message).toMatch(/Échec/);
  });

  it('creates a walk-in broiler sale', async () => {
    driveDraft({ productType: 'BROILER', quantity: 30, unitName: 'B-12', unitPriceXof: 2500 }, 'QUICK_SALE', 3);
    mockCreateSale.mockReturnValue(ok());

    const { result } = await renderHook(() => useAssistant());
    await act(async () => {
      await result.current.submit('vends 30 poulets à 2500');
    });
    let done: boolean | undefined;
    await act(async () => {
      done = await result.current.confirm();
    });

    expect(done).toBe(true);
    expect(mockCreateSale).toHaveBeenCalledWith({
      farmId: 7,
      body: {
        clientId: null,
        lines: [
          { articleKey: 'BROILER', articleSource: 'PRODUCTION', quantity: 30, unitPriceXof: 2500, productType: 'BROILER', productionUnitId: 3 },
        ],
      },
    });
  });

  it('blocks a sale with no price and asks for it', async () => {
    driveDraft({ productType: 'BROILER', quantity: 30, unitName: 'B-12' }, 'QUICK_SALE', 3);

    const { result } = await renderHook(() => useAssistant());
    await act(async () => {
      await result.current.submit('vends 30 poulets');
    });
    let done: boolean | undefined;
    await act(async () => {
      done = await result.current.confirm();
    });

    expect(done).toBe(false);
    expect(mockCreateSale).not.toHaveBeenCalled();
    expect(result.current.message).toMatch(/prix/i);
  });

  it('creates a supplier purchase order', async () => {
    driveDraft({ articleKey: 'aliment', articleSource: 'INVENTORY', quantity: 10, supplierId: 3, unitPriceXof: 15000 }, 'PURCHASE', null);
    mockCreatePurchaseOrder.mockReturnValue(ok());

    const { result } = await renderHook(() => useAssistant());
    await act(async () => {
      await result.current.submit('acheté 10 sacs aliment chez Sahel à 15000');
    });
    let done: boolean | undefined;
    await act(async () => {
      done = await result.current.confirm();
    });

    expect(done).toBe(true);
    expect(mockCreatePurchaseOrder).toHaveBeenCalledWith({
      farmId: 7,
      body: {
        supplierId: 3,
        lines: [{ articleKey: 'aliment', articleSource: 'INVENTORY', orderedQuantity: 10, unitPriceXof: 15000 }],
      },
    });
  });
});
