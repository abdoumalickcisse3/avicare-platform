import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

jest.mock('expo-router', () => ({ useRouter: jest.fn(() => ({ back: jest.fn() })), Redirect: () => null }));
jest.mock('react-redux', () => ({ useSelector: jest.fn(() => 7), useDispatch: jest.fn(() => jest.fn()), useStore: jest.fn(() => ({})) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' }, NotificationFeedbackType: { Success: 'success' } }));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/auth/useSession', () => ({ useFarmAccess: jest.fn(() => ({ farmRole: 'OWNER', can: () => true, isAdmin: true, session: null })) }));
jest.mock('@/store/api/catalogApi', () => ({ useGetCatalogQuery: jest.fn(() => ({ data: [{ key: 'feed', value: { label: 'Aliment' } }] })) }));
jest.mock('@/store/api/financeApi', () => ({
  useGetExpensesQuery: jest.fn(() => ({ data: [{ id: 1, categoryKey: 'feed', amountXof: 50000, expenseDate: '2026-08-01', label: 'Sac aliment', notes: null, productionUnitId: null, source: 'MANUAL' }], isLoading: false })),
  useCreateExpenseMutation: jest.fn(() => [jest.fn(() => ({ unwrap: () => Promise.resolve({}) })), { isLoading: false }]),
  useGetSalariesQuery: jest.fn(() => ({ data: [], isLoading: false })),
  usePaySalaryMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
  useGetFarmAnalyticsQuery: jest.fn(() => ({
    data: {
      totalRevenueXof: 800000,
      directSalesXof: 500000,
      paidOrdersXof: 300000,
      totalExpenseXof: 300000,
      marginXof: 500000,
      expensesByCategory: [{ categoryKey: 'feed', label: 'Aliment', amountXof: 200000 }],
      revenueByUnit: [{ unitId: 1, unitName: 'Lot A', revenueXof: 500000 }],
    },
    isLoading: false,
  })),
}));

import FinanceScreen from '../finance';

describe('Finance', () => {
  it('shows the expenses tab with the list and a create action', async () => {
    await render(<FinanceScreen />);
    expect(screen.getByText('Sac aliment')).toBeTruthy();
    expect(screen.getByLabelText('Nouvelle dépense')).toBeTruthy();
    // switch to Salaires tab
    await press(screen.getByLabelText('Onglet Salaires'));
    expect(screen.getByText('Aucun salaire.')).toBeTruthy();
  });

  it('shows the Analytique tab with the P&L margin and breakdowns', async () => {
    await render(<FinanceScreen />);
    await press(screen.getByLabelText('Onglet Analytique'));
    expect(screen.getByText('Marge cumulée')).toBeTruthy();
    expect(screen.getByText('Revenus vs Dépenses')).toBeTruthy();
    expect(screen.getByText('Dépenses par catégorie')).toBeTruthy();
    expect(screen.getByText('Revenu par lot')).toBeTruthy();
    expect(screen.getByText('Lot A')).toBeTruthy();
  });
});
