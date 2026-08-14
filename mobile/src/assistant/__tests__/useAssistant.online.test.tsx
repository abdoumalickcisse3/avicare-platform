import { act, renderHook } from '@testing-library/react-native';

const mockInterpret = jest.fn();
const mockRecordPayment = jest.fn();
const mockEnqueue = jest.fn();

jest.mock('react-redux', () => ({
  useSelector: () => 7,
  useDispatch: () => jest.fn(),
  useStore: () => ({}),
}));
jest.mock('@/store/api/productionUnitsApi', () => ({ useListProductionUnitsQuery: () => ({ data: [] }) }));
jest.mock('@/store/api/assistantApi', () => ({ useInterpretMutation: () => [mockInterpret] }));
jest.mock('@/store/api/paymentsApi', () => ({ useRecordPaymentMutation: () => [mockRecordPayment] }));
jest.mock('@/field/enqueueMutation', () => ({ enqueueFieldMutation: (...a: unknown[]) => mockEnqueue(...a) }));

import { useAssistant } from '@/assistant/useAssistant';

const paymentDraft = {
  kind: 'DRAFT',
  action: 'RECORD_PAYMENT',
  unitId: null,
  fields: { invoiceId: 42, invoiceNumber: 'FAC-042', clientName: 'Diallo', amountXof: 30000, method: 'CASH' },
};

beforeEach(() => {
  mockInterpret.mockReturnValue({ unwrap: () => Promise.resolve(paymentDraft) });
  mockRecordPayment.mockReset();
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
});
