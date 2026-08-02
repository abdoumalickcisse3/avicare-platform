import { render, screen } from '@testing-library/react-native';

const mockAccess = { farmRole: 'OWNER', can: () => true, isAdmin: true, session: null };

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/store/api/clientsApi', () => ({
  useGetClientsQuery: jest.fn(() => ({ data: [], isLoading: false })),
}));
jest.mock('@/auth/useSession', () => ({ useFarmAccess: jest.fn(() => mockAccess) }));

import CommerceScreen from '../commerce';

describe('Commerce tab FAB', () => {
  it('shows the Vente FAB for an OWNER', async () => {
    mockAccess.farmRole = 'OWNER';
    await render(<CommerceScreen />);
    expect(screen.getByLabelText('Nouvelle vente')).toBeTruthy();
  });

  it('hides the FAB for a FARMER', async () => {
    mockAccess.farmRole = 'FARMER';
    await render(<CommerceScreen />);
    expect(screen.queryByLabelText('Nouvelle vente')).toBeNull();
  });
});
