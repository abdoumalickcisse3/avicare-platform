/**
 * Le garde-barrière du groupe « terrain ».
 *
 * Le cas qui compte ici est l'écran « Accès réservé » : une session ouverte, aucun onglet monté,
 * et — avant ce correctif — aucun geste pour en sortir. Un compte staff qui se connectait par
 * erreur sur le téléphone était enfermé jusqu'à la désinstallation de l'app.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockSignOut = jest.fn(() => Promise.resolve());

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text>redirect:{href}</Text>;
  },
  Stack: () => null,
}));

jest.mock('@/auth/signOut', () => ({ signOut: () => mockSignOut() }));
jest.mock('@/auth/tokens', () => ({ getAccessToken: () => Promise.resolve('un-jeton') }));
jest.mock('@/auth/useSession', () => ({
  useFarmAccess: () => ({ isAdmin: false, can: () => false, farmRole: null }),
}));
jest.mock('@/sync', () => ({ subscribeAuthInvalidated: () => () => undefined }));
jest.mock('@/sync/triggers', () => ({ startSyncTriggers: () => () => undefined }));
jest.mock('@/sync/useSyncStatus', () => ({
  useSyncStatus: () => ({ online: true, pending: 0, failed: 0, syncing: false }),
}));
jest.mock('@/push/usePushNotifications', () => ({ usePushNotifications: () => undefined }));
jest.mock('@/components/SyncStatusBar', () => ({ SyncStatusBar: () => null }));
jest.mock('@/components/ui/BottomNavBar', () => ({ BottomNavBar: () => null }));
jest.mock('@/components/navigation/DrawerOverlay', () => ({ DrawerOverlay: () => null }));
jest.mock('@/tour/FieldTour', () => ({ FieldTour: () => null }));

// Le rôle décidé par le jeton : c'est lui qui envoie sur « Accès réservé » ou sur l'app.
const mockHasFieldAccess = jest.fn(() => false);
jest.mock('@/auth/session', () => ({
  decodeSession: () => ({}),
  hasFieldAccess: () => mockHasFieldAccess(),
}));

// eslint-disable-next-line import/first
import FieldLayout from '../_layout';

describe('écran « Accès réservé »', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offre une sortie au compte qui n’a rien à faire sur le terrain', async () => {
    mockHasFieldAccess.mockReturnValue(false);

    await render(<FieldLayout />);

    expect(screen.getByText('Accès réservé')).toBeTruthy();
    expect(screen.getByLabelText('Changer de compte')).toBeTruthy();
  });

  it('déconnecte vraiment et renvoie à l’écran de connexion', async () => {
    mockHasFieldAccess.mockReturnValue(false);

    await render(<FieldLayout />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Changer de compte'));
    });

    // signOut() fait le travail entier — purge de la file, révocation du jeton serveur,
    // effacement du cache. Se contenter d'un router.replace laisserait la session ouverte.
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('ne montre pas cet écran à une équipe de terrain', async () => {
    mockHasFieldAccess.mockReturnValue(true);

    await render(<FieldLayout />);

    expect(screen.queryByText('Accès réservé')).toBeNull();
  });
});
