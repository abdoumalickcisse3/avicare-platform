import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

/**
 * Saisir dans un champ, puis laisser React propager l'état.
 *
 * Sans ce `act`, `fireEvent.changeText` part sans que le rendu suivant ait eu lieu : le bouton lit
 * encore un formulaire vide et reste désactivé. Le test échoue alors sur « aucun appel », ce qui
 * ressemble à un défaut du composant et n'en est pas un.
 */
const type = (el: Parameters<typeof fireEvent.changeText>[0], text: string): Promise<void> =>
  act(async () => {
    fireEvent.changeText(el, text);
  });

const mockPreview: { ownedFarmCount: number } = { ownedFarmCount: 0 };
const mockDelete = jest.fn((_arg: { password: string }) => ({
  unwrap: () => Promise.resolve(undefined),
}));
jest.mock('@/store/api/authApi', () => ({
  useGetDeletionPreviewQuery: jest.fn(() => ({ data: mockPreview, isLoading: false })),
  useDeleteAccountMutation: jest.fn(() => [mockDelete, { isLoading: false }]),
}));
const mockSignOut = jest.fn(async () => undefined);
jest.mock('@/auth/signOut', () => ({ signOut: () => mockSignOut() }));

import { DeleteAccountSheet } from '../DeleteAccountSheet';

const open = () => render(<DeleteAccountSheet open onClose={jest.fn()} />);

beforeEach(() => {
  mockPreview.ownedFarmCount = 0;
  mockDelete.mockClear();
  mockSignOut.mockClear();
});

describe('Supprimer mon compte', () => {
  it("nomme ce qui disparaît quand l'utilisateur possède une ferme", async () => {
    // Apple exige la suppression depuis l'app ; le produit exige qu'on dise ce qu'elle emporte.
    mockPreview.ownedFarmCount = 1;
    await open();

    expect(screen.getByText(/bandes, ventes, factures, dépenses/)).toBeTruthy();
    expect(screen.getByText(/tous les autres membres/)).toBeTruthy();
  });

  it('dit au contraire que les fermes survivent à un simple membre', async () => {
    // Gérant, ouvrier, vétérinaire : la ferme n'a jamais été la leur.
    await open();

    expect(screen.getByText(/elles ne sont pas supprimées/)).toBeTruthy();
  });

  it('accorde le libellé au nombre de fermes', async () => {
    mockPreview.ownedFarmCount = 3;
    await open();

    expect(screen.getByText(/Vos 3 fermes/)).toBeTruthy();
  });

  it('refuse de supprimer sans mot de passe ni confirmation', async () => {
    mockPreview.ownedFarmCount = 1;
    await open();
    await press(screen.getByLabelText('Supprimer définitivement mon compte'));

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('refuse tant que le mot de confirmation est incomplet', async () => {
    await open();
    await type(screen.getByLabelText('Mot de passe'), 'Test1234!');
    // Un mot approchant ne suffit pas : la case à cocher se coche par réflexe, pas le mot.
    await type(screen.getByLabelText('Confirmation'), 'SUPPRIM');
    await press(screen.getByLabelText('Supprimer définitivement mon compte'));

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('supprime puis ferme la session quand tout est saisi', async () => {
    await open();
    await type(screen.getByLabelText('Mot de passe'), 'Test1234!');
    await type(screen.getByLabelText('Confirmation'), 'SUPPRIMER');
    await press(screen.getByLabelText('Supprimer définitivement mon compte'));

    expect(mockDelete).toHaveBeenCalledWith({ password: 'Test1234!' });
    // Le compte n'existe plus : rester sur l'écran laisserait un jeton mort en place.
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('accepte la confirmation en minuscules', async () => {
    await open();
    await type(screen.getByLabelText('Mot de passe'), 'Test1234!');
    await type(screen.getByLabelText('Confirmation'), 'supprimer');
    await press(screen.getByLabelText('Supprimer définitivement mon compte'));

    expect(mockDelete).toHaveBeenCalled();
  });

  it('affiche le refus du serveur au lieu de fermer la session', async () => {
    mockDelete.mockImplementationOnce(() => ({
      unwrap: () =>
        Promise.reject({ status: 403, data: { detail: 'Mot de passe incorrect.' } }),
    }));
    await open();
    await type(screen.getByLabelText('Mot de passe'), 'mauvais');
    await type(screen.getByLabelText('Confirmation'), 'SUPPRIMER');
    await press(screen.getByLabelText('Supprimer définitivement mon compte'));

    expect(screen.getByText('Mot de passe incorrect.')).toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
