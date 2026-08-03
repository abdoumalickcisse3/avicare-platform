import { render, screen } from '@testing-library/react-native';

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
jest.mock('@/store/api/clientsApi', () => ({
  useGetClientsQuery: jest.fn(() => ({ data: [{ id: 3, displayName: 'Awa Diop' }] })),
}));
jest.mock('@/store/api/paymentsApi', () => ({
  useRecordPaymentMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
}));
jest.mock('@/store/api/invoicesApi', () => ({
  useGetInvoiceQuery: jest.fn(() => ({
    data: {
      id: 9, farmId: 7, invoiceNumber: 'F-001', clientId: 3, status: 'ISSUED', issueDate: '2026-08-01', dueDate: null,
      totalXof: 12000, amountPaidXof: 0, outstandingXof: 12000,
      items: [{ id: 1, articleKey: 'BROILER', articleSource: 'PRODUCTION', articleLabelSnapshot: 'Poulet', unit: 'tête', quantity: 6, unitPriceXof: 2000, lineTotalXof: 12000 }],
    },
    isLoading: false,
  })),
}));

import FactureDetailScreen from '../[id]';

describe('Facture detail', () => {
  it('shows the invoice, its amounts and an Encaisser action when unpaid (OWNER)', async () => {
    await render(<FactureDetailScreen />);
    expect(screen.getByText('F-001')).toBeTruthy();
    expect(screen.getByText('Awa Diop')).toBeTruthy();
    expect(screen.getByLabelText('Encaisser')).toBeTruthy();
  });
});
