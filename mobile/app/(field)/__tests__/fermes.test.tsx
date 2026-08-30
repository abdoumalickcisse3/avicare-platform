import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

jest.mock('expo-router', () => ({ useRouter: jest.fn(() => ({ back: jest.fn() })), Redirect: () => null }));
jest.mock('react-redux', () => ({ useSelector: jest.fn(() => 7), useDispatch: jest.fn(() => jest.fn()), useStore: jest.fn(() => ({})) }));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/auth/useSession', () => ({ useFarmAccess: jest.fn(() => ({ isAdmin: true, can: () => true, farmRole: 'OWNER', session: null })) }));
jest.mock('@/store/api/farmsApi', () => ({
  useListFarmsQuery: jest.fn(() => ({ data: [{ id: 7, name: 'Ferme Test', location: 'Thiès', active: true }] })),
  useGetFarmQuery: jest.fn(() => ({ data: { id: 7, name: 'Ferme Test', location: 'Thiès', capacity: 5000, currency: 'XOF', gpsLatitude: 14.79, gpsLongitude: -16.93, description: 'Ferme pilote' } })),
  useUpdateFarmMutation: () => [jest.fn(), { isLoading: false }],
  useCreateFarmMutation: () => [jest.fn(), { isLoading: false }],
  useDeleteFarmMutation: () => [jest.fn(), { isLoading: false }],
}));
jest.mock('@/store/api/permissionsApi', () => ({
  useGetPermissionCatalogQuery: jest.fn(() => ({
    data: {
      resources: [
        { resource: 'poultry', label: 'Élevage volaille', verbs: ['read', 'write', 'delete'] },
        { resource: 'inventory', label: 'Stock', verbs: ['read', 'write', 'consume'] },
      ],
      roleDefaults: { FARMER: ['poultry:read', 'poultry:write'], MANAGER: ['poultry:*'] },
    },
  })),
}));
jest.mock('@/store/api/dashboardApi', () => ({
  useGetDashboardQuery: jest.fn(() => ({ data: { livestock: { totalHeadcount: 1200, mortalityRate: 1.5, layingRate: 88, dailyFeedKg: 42 } }, isLoading: false })),
}));
jest.mock('@/store/api/activityApi', () => ({ useGetFarmActivityQuery: jest.fn(() => ({ data: [{ kind: 'x', at: '2026-08-01T10:00:00', label: 'Mortalité enregistrée', detail: null }], isLoading: false })) }));
jest.mock('@/store/api/membersApi', () => ({
  useGetMembersQuery: jest.fn(() => ({ data: [{ id: 1, userId: 3, farmId: 7, fullName: 'Awa Ndiaye', email: 'awa@test.sn', phone: null, role: 'FARMER', permissions: [], active: true }], isLoading: false })),
  useCreateMemberMutation: () => [jest.fn(), { isLoading: false }],
  useUpdateMemberMutation: () => [jest.fn(), { isLoading: false }],
  useResetMemberPasswordMutation: () => [jest.fn(), { isLoading: false }],
  useRemoveMemberMutation: () => [jest.fn(), { isLoading: false }],
}));

import { useFarmAccess } from '@/auth/useSession';
import { useGetMembersQuery } from '@/store/api/membersApi';
import FermesScreen from '../fermes';

describe('Fermes', () => {
  it('renders while the session is still loading (no flash-redirect before isAdmin is known)', async () => {
    // Token not yet decoded: session null, isAdmin false. The guard must wait
    // for the session before redirecting, so the screen still renders.
    (useFarmAccess as jest.Mock).mockReturnValueOnce({ isAdmin: false, can: () => false, farmRole: undefined, session: null });
    await render(<FermesScreen />);
    expect(screen.getByText('Ferme Test')).toBeTruthy();
  });

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
  it('lets an owner open a member, and leaves the owner row alone', async () => {
    (useFarmAccess as jest.Mock).mockReturnValue({ isAdmin: true, can: () => true, farmRole: 'OWNER', session: { role: 'USER' } });
    (useGetMembersQuery as jest.Mock).mockReturnValue({
      data: [
        { id: 1, userId: 3, farmId: 7, fullName: 'Awa Ndiaye', email: 'awa@test.sn', phone: null, role: 'FARMER', permissions: [], active: true },
        { id: 2, userId: 1, farmId: 7, fullName: 'Le Patron', email: 'boss@test.sn', phone: null, role: 'OWNER', permissions: ['*'], active: true },
      ],
      isLoading: false,
    });

    await render(<FermesScreen />);
    await press(screen.getByLabelText('Onglet Équipe'));

    expect(screen.getByLabelText('Ajouter un membre')).toBeTruthy();
    expect(screen.getByLabelText('Modifier Awa Ndiaye')).toBeTruthy();
    // The backend refuses to reassign OWNER, so its row opens nothing.
    expect(screen.queryByLabelText('Modifier Le Patron')).toBeNull();
  });

  it('still lists a removed member, marked, so the removal can be undone', async () => {
    (useFarmAccess as jest.Mock).mockReturnValue({ isAdmin: true, can: () => true, farmRole: 'OWNER', session: { role: 'USER' } });
    (useGetMembersQuery as jest.Mock).mockReturnValue({
      data: [{ id: 1, userId: 3, farmId: 7, fullName: 'Awa Ndiaye', email: 'awa@test.sn', phone: null, role: 'FARMER', permissions: [], active: false }],
      isLoading: false,
    });

    await render(<FermesScreen />);
    await press(screen.getByLabelText('Onglet Équipe'));

    expect(screen.getByText('Retiré')).toBeTruthy();
    expect(screen.getByLabelText('Modifier Awa Ndiaye')).toBeTruthy();
  });

  it('hides the team buttons from a platform admin with no membership on this farm', async () => {
    // isAdmin gets them onto the screen; the backend gates the writes on the farm role, so a
    // visible button here would only collect a 403.
    (useFarmAccess as jest.Mock).mockReturnValue({ isAdmin: true, can: () => true, farmRole: undefined, session: { role: 'ADMIN' } });

    await render(<FermesScreen />);
    await press(screen.getByLabelText('Onglet Équipe'));

    expect(screen.queryByLabelText('Ajouter un membre')).toBeNull();
  });

  it('shows the farm settings instead of promising them later', async () => {
    (useFarmAccess as jest.Mock).mockReturnValue({ isAdmin: true, can: () => true, farmRole: 'OWNER', session: { role: 'USER' } });

    await render(<FermesScreen />);
    await press(screen.getByLabelText('Onglet Paramètres'));

    // Read from `getFarm`, not the list projection: the list carries neither capacity nor currency.
    expect(screen.getByText('XOF')).toBeTruthy();
    expect(screen.getByText(/5\s?000 sujets/)).toBeTruthy();
    expect(screen.getByLabelText('Modifier la ferme')).toBeTruthy();
  });

  it('offers a second farm, and says what creating one does', async () => {
    (useFarmAccess as jest.Mock).mockReturnValue({ isAdmin: true, can: () => true, farmRole: 'OWNER', session: { role: 'USER' } });

    await render(<FermesScreen />);
    await press(screen.getByLabelText('Onglet Paramètres'));

    expect(screen.getByLabelText('Créer une ferme')).toBeTruthy();
    expect(screen.getByText(/s'ajoute au sélecteur/)).toBeTruthy();
  });
});
