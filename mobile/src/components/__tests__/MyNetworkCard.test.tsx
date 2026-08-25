import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), back: jest.fn() })),
}));

const mockQuery = jest.fn();
jest.mock('@/store/api/partnersApi', () => ({
  useGetMyPartnersQuery: (...args: unknown[]) => mockQuery(...args),
}));

import { MyNetworkCard } from '../field/MyNetworkCard';

function partner(over: Record<string, unknown> = {}) {
  return {
    membershipId: 1,
    partnerId: 3,
    partnerName: 'Provende du Sahel',
    partnerType: 'FEED_SUPPLIER',
    partnerLogoUrl: 'https://cdn.example/sahel.png',
    status: 'CONFIRMED',
    origin: 'MANUAL_ADMIN',
    shareActivity: true,
    shareFlockHealth: true,
    shareFeedConsumption: true,
    shareSalesVolume: false,
    shareFinances: false,
    ...over,
  };
}

beforeEach(() => mockQuery.mockReset());

describe('MyNetworkCard (mobile)', () => {
  it('shows the partner name and its logo', async () => {
    mockQuery.mockReturnValue({ data: [partner()] });

    await render(<MyNetworkCard farmId={8} />);

    expect(screen.getByText('Provende du Sahel')).toBeTruthy();
    expect(screen.getByLabelText('Provende du Sahel')).toBeTruthy();
    expect(screen.getByLabelText('Gérer le partage')).toBeTruthy();
  });

  it('falls back to the initial when the partner has no logo', async () => {
    mockQuery.mockReturnValue({ data: [partner({ partnerLogoUrl: null })] });

    await render(<MyNetworkCard farmId={8} />);

    expect(screen.getByText('Provende du Sahel')).toBeTruthy();
    expect(screen.getByText('P')).toBeTruthy();
  });

  it('renders nothing when no partner is confirmed', async () => {
    // A declared-but-unconfirmed membership is not a network yet.
    mockQuery.mockReturnValue({ data: [partner({ status: 'DECLARED' })] });

    const { toJSON } = await render(<MyNetworkCard farmId={8} />);

    // Nothing to co-brand: the block must not take up room on a one-handed screen.
    expect(toJSON()).toBeNull();
  });
});
