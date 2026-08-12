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
});
