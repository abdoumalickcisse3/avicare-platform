import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ clientId: '3' })),
  useRouter: jest.fn(() => ({ back: jest.fn() })),
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
const mockClient = {
  id: 3,
  farmId: 7,
  displayName: 'Awa Diop',
  clientType: 'INDIVIDUAL',
  currentBalanceXof: 12000,
  creditLimitXof: 20000,
  legalName: null,
  phone: null,
  email: null,
  address: null,
  city: 'Thiès',
  defaultPaymentTerms: null,
  active: true,
  notes: null,
};

jest.mock('@/store/api/clientsApi', () => ({
  useGetClientsQuery: jest.fn(() => ({ data: [mockClient] })),
  useGetClientQuery: jest.fn(() => ({ data: mockClient })),
  useGetClientCreditQuery: jest.fn(() => ({
    data: {
      clientId: 3,
      displayName: 'Awa Diop',
      creditLimitXof: 20000,
      currentBalanceXof: 12000,
      overLimit: false,
      overLimitPercent: null,
    },
  })),
  useUpdateClientMutation: () => [jest.fn(), { isLoading: false }],
  useDeactivateClientMutation: () => [jest.fn(), { isLoading: false }],
}));
jest.mock('@/store/api/paymentsApi', () => ({
  useGetPaymentsQuery: jest.fn(() => ({
    data: [
      { id: 1, farmId: 7, paymentNumber: 'P-001', invoiceId: 9, clientId: 3, amountXof: 5000, method: 'CASH', status: 'COMPLETED', paymentDate: '2026-08-01', reference: null, notes: null },
      { id: 2, farmId: 7, paymentNumber: 'P-002', invoiceId: 9, clientId: 3, amountXof: 3000, method: 'CASH', status: 'CANCELLED', paymentDate: '2026-07-20', reference: null, notes: null },
    ],
  })),
  useVoidPaymentMutation: () => [jest.fn(), { isLoading: false }],
}));
jest.mock('@/store/api/invoicesApi', () => ({
  useGetInvoicesQuery: jest.fn(() => ({
    data: [
      { id: 9, invoiceNumber: 'F-001', status: 'ISSUED', outstandingXof: 12000, totalXof: 12000, amountPaidXof: 0, dueDate: null },
    ],
    isLoading: false,
  })),
}));

import { useFarmAccess } from '@/auth/useSession';
import ClientDetailScreen from '../[clientId]';

describe('Client detail', () => {
  it('shows the client, encours and an Encaisser action for OWNER', async () => {
    await render(<ClientDetailScreen />);
    expect(screen.getByText('Awa Diop')).toBeTruthy();
    expect(screen.getByText('F-001')).toBeTruthy();
    expect(screen.getByLabelText('Encaisser')).toBeTruthy();
  });
});

describe('Client detail — lot 5', () => {
  it('shows the credit limit without turning it into a blocker', async () => {
    // D26: the backend computes overLimit and never blocks a sale on it.
    await render(<ClientDetailScreen />);

    expect(screen.getByText(/Plafond/)).toBeTruthy();
    expect(screen.getByText('Dans la limite')).toBeTruthy();
  });

  it('lists the payments, cancelled ones included', async () => {
    // A voided payment keeps its row and flips to CANCELLED; hiding it would lose the trail.
    await render(<ClientDetailScreen />);

    expect(screen.getByText(/2026-07-20 · annulé/)).toBeTruthy();
  });

  it('offers to void only a payment that is still live', async () => {
    await render(<ClientDetailScreen />);

    expect(screen.getByLabelText(/Annuler le paiement de/)).toBeTruthy();
    // One live payment, one already cancelled → exactly one cancel affordance.
    expect(screen.getAllByLabelText(/Annuler le paiement de/)).toHaveLength(1);
  });

  it('lets an owner open the client for editing', async () => {
    await render(<ClientDetailScreen />);

    expect(screen.getByLabelText('Modifier le client')).toBeTruthy();
  });

  it('hides editing and voiding from someone who cannot collect', async () => {
    (useFarmAccess as jest.Mock).mockReturnValue({
      farmRole: 'FARMER',
      can: () => true,
      isAdmin: false,
      session: null,
    });

    await render(<ClientDetailScreen />);

    expect(screen.queryByLabelText('Modifier le client')).toBeNull();
    expect(screen.queryByLabelText(/Annuler le paiement de/)).toBeNull();
  });
});
