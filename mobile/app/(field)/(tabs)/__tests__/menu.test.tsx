import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

jest.mock('expo-router', () => ({ useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })) }));
jest.mock('react-redux', () => ({ useSelector: jest.fn(() => 7), useDispatch: jest.fn(() => jest.fn()), useStore: jest.fn(() => ({})) }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: 'success' } }));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/store/api/farmsApi', () => ({ useListFarmsQuery: jest.fn(() => ({ data: [{ id: 7, name: 'Ferme Test' }] })) }));
// signOut pulls the sync queue in, which opens a native SQLite handle at import time.
jest.mock('@/auth/signOut', () => ({ signOut: jest.fn() }));
jest.mock('@/sync/useSyncStatus', () => ({ useSyncStatus: jest.fn(() => ({ online: true, pending: 0, failed: 0 })) }));
// A FARMER: no `settings:read`, so Réglages is out of reach — which is the whole reason the
// account rows live in this tab.
jest.mock('@/auth/useSession', () => ({
  useFarmAccess: jest.fn(() => ({
    can: (perm: string) => ['poultry:read', 'poultry:write', 'health:read', 'health:write'].includes(perm),
    isAdmin: false,
    farmRole: 'FARMER',
    session: null,
  })),
}));
const mockRequestAdvance = jest.fn(() => ({ unwrap: () => Promise.resolve({}) }));
jest.mock('@/store/api/financeApi', () => ({
  useGetMyAdvancesQuery: jest.fn(() => ({
    data: [
      { id: 1, userId: 3, amountXof: 25000, reason: 'Rentrée scolaire', status: 'APPROVED', requestedAt: '2026-08-01T09:00:00', remainingXof: 10000 },
    ],
    isLoading: false,
  })),
  useRequestAdvanceMutation: jest.fn(() => [mockRequestAdvance, { isLoading: false }]),
}));

import MenuScreen from '../menu';

describe('Menu — mon compte', () => {
  it('gives a farmer their profile and their advances', async () => {
    await render(<MenuScreen />);

    expect(screen.getByLabelText('Mon profil')).toBeTruthy();
    expect(screen.getByLabelText('Mes avances')).toBeTruthy();
  });

  it('opens the advances sheet with the history and what is still owed', async () => {
    await render(<MenuScreen />);
    await press(screen.getByLabelText('Mes avances'));

    expect(
      screen.getByText('Une avance accordée est retenue sur vos prochains salaires.'),
    ).toBeTruthy();
    expect(screen.getByText(/restent à retenir sur vos prochains salaires/)).toBeTruthy();
    expect(screen.getByText('Accordée')).toBeTruthy();
  });

  it('refuses to send an empty or zero request', async () => {
    await render(<MenuScreen />);
    await press(screen.getByLabelText('Mes avances'));
    await press(screen.getByLabelText("Demander l'avance"));

    expect(mockRequestAdvance).not.toHaveBeenCalled();
  });

  it('sends the request with the farm the user is on', async () => {
    await render(<MenuScreen />);
    await press(screen.getByLabelText('Mes avances'));
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Montant de l'avance"), '15000');
      fireEvent.changeText(screen.getByLabelText("Motif de l'avance"), 'Ordonnance');
    });
    await press(screen.getByLabelText("Demander l'avance"));

    expect(mockRequestAdvance).toHaveBeenCalledWith({
      body: { farmId: 7, amountXof: 15000, reason: 'Ordonnance' },
    });
  });
});
