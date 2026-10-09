import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../login';

const mockReplace = jest.fn();
const mockLogin = jest.fn(() => ({
  unwrap: () => Promise.resolve({ accessToken: 'a', refreshToken: 'r' }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));
jest.mock('@/store/api/authApi', () => ({
  useLoginMutation: () => [mockLogin, { isLoading: false }],
}));
jest.mock('@/auth/tokens', () => ({
  saveTokens: jest.fn(() => Promise.resolve()),
}));

beforeEach(() => jest.clearAllMocks());

describe('LoginScreen', () => {
  it('ouvre sur l’e-mail, sans sélecteur de pays', async () => {
    await render(<LoginScreen />);

    expect(screen.getByText('Adresse e-mail')).toBeTruthy();
    expect(screen.queryByLabelText(/Indicatif pays/)).toBeNull();
  });

  it('bascule sur le numéro, montre l’indicatif, et vide ce qui était tapé', async () => {
    await render(<LoginScreen />);

    // Une adresse n'est pas un numéro : la reporter laisserait une demi-adresse dans le champ.
    fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'awa@jawdi.app');
    await userEvent.press(screen.getByLabelText('Identifiant par numéro'));

    expect(screen.getByLabelText(/Indicatif pays/)).toBeTruthy();
    expect(screen.getByText('+221')).toBeTruthy();
    expect(screen.queryByDisplayValue('awa@jawdi.app')).toBeNull();
  });

  /**
   * The reason the selector exists at all. Without it the field can only guess a country, and a
   * Beninese worker typing 01 56 34 34 08 would be looked up as +221156343408 — nobody.
   */
  it('envoie un numéro béninois complet quand on choisit le Bénin', async () => {
    await render(<LoginScreen />);

    await userEvent.press(screen.getByLabelText('Identifiant par numéro'));
    await userEvent.press(screen.getByLabelText(/Indicatif pays/));
    await userEvent.press(screen.getByLabelText('Bénin'));
    fireEvent.changeText(screen.getByLabelText('Numéro de téléphone'), '0156343408');
    fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'password123');
    await userEvent.press(screen.getByLabelText('Se connecter'));

    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith(
        expect.objectContaining({ email: '+2290156343408' }),
      ),
    );
  });
});
