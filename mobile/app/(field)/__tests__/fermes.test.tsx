import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

jest.mock('expo-router', () => ({ useRouter: jest.fn(() => ({ back: jest.fn() })), Redirect: () => null }));
jest.mock('react-redux', () => ({ useSelector: jest.fn(() => 7), useDispatch: jest.fn(() => jest.fn()), useStore: jest.fn(() => ({})) }));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/auth/useSession', () => ({ useFarmAccess: jest.fn(() => ({ isAdmin: true, can: () => true, farmRole: 'OWNER', session: null })) }));
jest.mock('@/store/api/farmsApi', () => ({ useListFarmsQuery: jest.fn(() => ({ data: [{ id: 7, name: 'Ferme Test', location: 'Thiès', active: true }] })) }));
jest.mock('@/store/api/dashboardApi', () => ({
  useGetDashboardQuery: jest.fn(() => ({ data: { livestock: { totalHeadcount: 1200, mortalityRate: 1.5, layingRate: 88, dailyFeedKg: 42 } }, isLoading: false })),
}));
jest.mock('@/store/api/activityApi', () => ({ useGetFarmActivityQuery: jest.fn(() => ({ data: [{ kind: 'x', at: '2026-08-01T10:00:00', label: 'Mortalité enregistrée', detail: null }], isLoading: false })) }));
jest.mock('@/store/api/membersApi', () => ({
  useGetMembersQuery: jest.fn(() => ({ data: [{ id: 1, userId: 3, farmId: 7, fullName: 'Awa Ndiaye', email: 'awa@test.sn', phone: null, role: 'FARMER', permissions: [], active: true }], isLoading: false })),
}));

import FermesScreen from '../fermes';

describe('Fermes', () => {
  it('shows the farm hero, overview KPIs and activity, then the team members', async () => {
    await render(<FermesScreen />);
    expect(screen.getByText('Ferme Test')).toBeTruthy();
    expect(screen.getByText('Opérationnel')).toBeTruthy();
    expect(screen.getByText('1 200')).toBeTruthy(); // formatNumber(1200)
    expect(screen.getByText('Mortalité enregistrée')).toBeTruthy();

    await press(screen.getByLabelText('Onglet Équipe'));
    expect(screen.getByText('Awa Ndiaye')).toBeTruthy();
    expect(screen.getByText('Éleveur')).toBeTruthy();
  });
});
