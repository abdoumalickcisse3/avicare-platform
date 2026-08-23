import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), back: jest.fn() })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 42),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
jest.mock('@/auth/useSession', () => ({
  useFarmAccess: jest.fn(() => ({ isAdmin: false, can: () => true, farmRole: 'OWNER', session: null })),
}));

const noopMutation = () => [jest.fn(() => ({ unwrap: () => Promise.resolve({}) })), {}];
jest.mock('@/store/api/partnersApi', () => ({
  useGetMyPartnersQuery: jest.fn(() => ({ data: [] })),
  useGetAvailablePartnersQuery: jest.fn(() => ({ data: [] })),
  useDeclarePartnerMutation: jest.fn(noopMutation),
  useJoinNetworkMutation: jest.fn(noopMutation),
  useUpdateSharingMutation: jest.fn(noopMutation),
  useLeaveNetworkMutation: jest.fn(noopMutation),
}));

import PartenairesScreen from '../partenaires';

describe('Mon réseau (mobile)', () => {
  it('renders the empty state with join and browse actions for an owner', async () => {
    await render(<PartenairesScreen />);
    expect(screen.getByText(/aucun réseau/i)).toBeTruthy();
    expect(screen.getByLabelText('Rejoindre par code')).toBeTruthy();
    expect(screen.getByLabelText('Parcourir les partenaires')).toBeTruthy();
  });
});
