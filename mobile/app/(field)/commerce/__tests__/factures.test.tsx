import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), back: jest.fn() })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
jest.mock('@/store/api/clientsApi', () => ({
  useGetClientsQuery: jest.fn(() => ({ data: [{ id: 3, displayName: 'Awa Diop' }] })),
}));
jest.mock('@/store/api/invoicesApi', () => ({
  useGetInvoicesQuery: jest.fn(() => ({
    data: [
      { id: 9, farmId: 7, invoiceNumber: 'F-001', clientId: 3, status: 'ISSUED', issueDate: '2026-08-01', dueDate: null, totalXof: 12000, amountPaidXof: 0, outstandingXof: 12000 },
    ],
    isLoading: false,
  })),
}));

import FacturesScreen from '../factures';

describe('Factures list', () => {
  it('lists invoices with number, client and outstanding', async () => {
    await render(<FacturesScreen />);
    expect(screen.getByText('F-001')).toBeTruthy();
    expect(screen.getByText('Awa Diop')).toBeTruthy();
  });
});
