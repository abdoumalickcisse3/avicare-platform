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
jest.mock('@/store/api/membersApi', () => ({
  useGetMembersQuery: jest.fn(() => ({
    data: [
      { id: 1, userId: 3, farmId: 7, fullName: 'Awa Ndiaye', email: 'a@x.io', phone: null, role: 'FARMER', permissions: [], active: true },
    ],
  })),
}));
jest.mock('@/store/api/financeApi', () => ({
  useGetExpenseSummaryQuery: jest.fn(() => ({ data: { categories: [], totalXof: 125000 } })),
  useGetExpensesQuery: jest.fn(() => ({ data: [{ id: 1, categoryKey: 'feed', amountXof: 50000, expenseDate: '2026-08-01', label: 'Sac aliment', notes: null, productionUnitId: null, source: 'MANUAL' }], isLoading: false })),
  useCreateExpenseMutation: jest.fn(() => [jest.fn(() => ({ unwrap: () => Promise.resolve({}) })), { isLoading: false }]),
  useGetSalariesQuery: jest.fn(() => ({ data: [], isLoading: false })),
  usePaySalaryMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
  useUpdateExpenseMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
  useDeleteExpenseMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
  useGetSalarySettingsQuery: jest.fn(() => ({ data: [{ id: 1, userId: 3, monthlySalaryXof: 90000, active: true }] })),
  useGenerateSalariesMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
  useGetAdvancesQuery: jest.fn(() => ({
    data: [
      { id: 1, userId: 3, amountXof: 25000, reason: 'Rentrée scolaire', status: 'PENDING', requestedAt: '2026-08-01T09:00:00', remainingXof: 0 },
      { id: 2, userId: 4, amountXof: 40000, reason: null, status: 'APPROVED', requestedAt: '2026-07-01T09:00:00', remainingXof: 15000 },
    ],
  })),
  useApproveAdvanceMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
  useRejectAdvanceMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
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
    // The empty state names the month: generation is per-period and cannot be re-run.
    expect(screen.getByText(/Aucun salaire pour \d{4}-\d{2}/)).toBeTruthy();
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

describe('Finance — lot 6', () => {
  it('opens a manual expense for correction', async () => {
    await render(<FinanceScreen />);

    expect(screen.getByLabelText('Corriger Sac aliment')).toBeTruthy();
  });

  it('offers to generate the month when no salary exists yet', async () => {
    await render(<FinanceScreen />);
    await press(screen.getByLabelText('Onglet Salaires'));

    expect(screen.getByLabelText('Générer les salaires')).toBeTruthy();
  });

  it('lists advances with the name behind the userId', async () => {
    await render(<FinanceScreen />);
    await press(screen.getByLabelText('Onglet Avances'));

    // The finance payload carries a userId only; the roster is what makes the row readable.
    expect(screen.getByText('Awa Ndiaye')).toBeTruthy();
  });

  it('offers a decision only on a pending advance', async () => {
    // approve/reject answer 422 ADVANCE_NOT_PENDING on anything already decided.
    await render(<FinanceScreen />);
    await press(screen.getByLabelText('Onglet Avances'));

    expect(screen.getByLabelText("Accorder l'avance de Awa Ndiaye")).toBeTruthy();
    expect(screen.queryByLabelText("Accorder l'avance de Salarié #4")).toBeNull();
  });

  it('shows what an approved advance still owes to future salaries', async () => {
    await render(<FinanceScreen />);
    await press(screen.getByLabelText('Onglet Avances'));

    expect(screen.getByText(/à retenir sur les salaires à venir/)).toBeTruthy();
  });
});
