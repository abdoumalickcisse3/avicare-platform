import { invoicesApi } from '../invoicesApi';
import { paymentsApi } from '../paymentsApi';

it('exposes the invoices + payments endpoints and hooks', () => {
  expect(invoicesApi.endpoints.getInvoices.name).toBe('getInvoices');
  expect(typeof invoicesApi.useGetInvoicesQuery).toBe('function');
  expect(paymentsApi.endpoints.recordPayment.name).toBe('recordPayment');
  expect(typeof paymentsApi.useRecordPaymentMutation).toBe('function');
});
