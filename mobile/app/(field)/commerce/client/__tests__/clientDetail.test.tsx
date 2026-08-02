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
jest.mock('@/store/api/clientsApi', () => ({
  useGetClientsQuery: jest.fn(() => ({
    data: [
      {
        id: 3,
        displayName: 'Awa Diop',
        clientType: 'INDIVIDUAL',
        currentBalanceXof: 12000,
        creditLimitXof: null,
        phone: null,
      },
    ],
  })),
}));
jest.mock('@/store/api/invoicesApi', () => ({
  useGetInvoicesQuery: jest.fn(() => ({
    data: [
      { id: 9, invoiceNumber: 'F-001', status: 'ISSUED', outstandingXof: 12000, totalXof: 12000, amountPaidXof: 0, dueDate: null },
    ],
    isLoading: false,
  })),
}));

import ClientDetailScreen from '../[clientId]';

describe('Client detail', () => {
  it('shows the client, encours and an Encaisser action for OWNER', async () => {
    await render(<ClientDetailScreen />);
    expect(screen.getByText('Awa Diop')).toBeTruthy();
    expect(screen.getByText('F-001')).toBeTruthy();
    expect(screen.getByLabelText('Encaisser')).toBeTruthy();
  });
});
