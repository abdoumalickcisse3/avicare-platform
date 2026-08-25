import { fireEvent, render, screen } from '@testing-library/react-native';

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
const mockPartners: { current: unknown[] } = { current: [] };
const mockUpdateSharing = jest.fn(() => ({ unwrap: () => Promise.resolve({}) }));
jest.mock('@/store/api/partnersApi', () => ({
  useGetMyPartnersQuery: jest.fn(() => ({ data: mockPartners.current })),
  useGetAvailablePartnersQuery: jest.fn(() => ({ data: [] })),
  useDeclarePartnerMutation: jest.fn(noopMutation),
  useJoinNetworkMutation: jest.fn(noopMutation),
  useUpdateSharingMutation: jest.fn(() => [mockUpdateSharing, {}]),
  useLeaveNetworkMutation: jest.fn(noopMutation),
}));

import PartenairesScreen from '../partenaires';

function membership(over: Record<string, unknown> = {}) {
  return {
    membershipId: 5,
    partnerId: 3,
    partnerName: 'Provende du Sahel',
    partnerType: 'FEED_SUPPLIER',
    status: 'CONFIRMED',
    origin: 'MANUAL_ADMIN',
    shareActivity: true,
    shareFlockHealth: true,
    shareFeedConsumption: true,
    shareSalesVolume: false,
    shareFinances: false,
    shareRestockForecast: false,
    ...over,
  };
}

beforeEach(() => {
  mockPartners.current = [];
  mockUpdateSharing.mockClear();
});

describe('Mon réseau (mobile)', () => {
  it('renders the empty state with join and browse actions for an owner', async () => {
    await render(<PartenairesScreen />);
    expect(screen.getByText(/aucun réseau/i)).toBeTruthy();
    expect(screen.getByLabelText('Rejoindre par code')).toBeTruthy();
    expect(screen.getByLabelText('Parcourir les partenaires')).toBeTruthy();
  });

  it('shows the restock forecast slider off on an existing membership', async () => {
    mockPartners.current = [membership()];

    await render(<PartenairesScreen />);

    expect(screen.getByText('Prévisions de recommande')).toBeTruthy();
    // No retroactive consent: a membership that predates the slider starts opted out.
    expect(screen.getByLabelText('5 restockForecast').props.value).toBe(false);
    expect(screen.getByLabelText('5 activity').props.value).toBe(true);
  });

  it('sends the opt-in when the farmer flips it', async () => {
    mockPartners.current = [membership()];

    await render(<PartenairesScreen />);
    fireEvent(screen.getByLabelText('5 restockForecast'), 'valueChange', true);

    // The consent must be revocable from the phone, so it must be settable from the phone.
    expect(mockUpdateSharing).toHaveBeenCalledWith(
      expect.objectContaining({
        farmId: 42,
        membershipId: 5,
        scopes: expect.objectContaining({ restockForecast: true }),
      }),
    );
  });
});
