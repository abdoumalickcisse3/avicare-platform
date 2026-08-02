import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const mockRecord = jest.fn(() => ({ unwrap: () => Promise.resolve({ id: 1 }) }));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('@/store/api/paymentsApi', () => ({
  useRecordPaymentMutation: jest.fn(() => [mockRecord, { isLoading: false }]),
}));

import { PaymentSheet } from '@/commerce/PaymentSheet';

const invoices = [
  { id: 9, farmId: 7, invoiceNumber: 'F-001', clientId: 3, status: 'ISSUED', issueDate: '2026-08-01', dueDate: null, totalXof: 12000, amountPaidXof: 0, outstandingXof: 12000 },
] as const;

describe('PaymentSheet', () => {
  beforeEach(() => mockRecord.mockClear());

  it('records a payment for the selected invoice at its balance', async () => {
    await render(
      <PaymentSheet farmId={7} invoices={invoices as never} open onClose={jest.fn()} onDone={jest.fn()} />,
    );
    await press(screen.getByLabelText("Confirmer l'encaissement"));
    expect(mockRecord).toHaveBeenCalledWith({
      farmId: 7,
      body: expect.objectContaining({ invoiceId: 9, amountXof: 12000, method: 'CASH' }),
    });
  });
});
