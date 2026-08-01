import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SignupScreen from '../signup';

const mockReplace = jest.fn();
const mockSignup = jest.fn(() => ({ unwrap: () => Promise.resolve({ accessToken: 'a', refreshToken: 'r' }) }));
const mockCreateFarm = jest.fn(() => ({ unwrap: () => Promise.resolve({ id: 1 }) }));
const mockRefresh = jest.fn(() => ({ unwrap: () => Promise.resolve({ accessToken: 'a2', refreshToken: 'r2' }) }));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));
jest.mock('@/store/api/authApi', () => ({
  useSignupMutation: () => [mockSignup, {}],
  useRefreshMutation: () => [mockRefresh, {}],
}));
jest.mock('@/store/api/farmsApi', () => ({
  useCreateFarmMutation: () => [mockCreateFarm, {}],
}));
jest.mock('@/auth/tokens', () => ({
  saveTokens: jest.fn(() => Promise.resolve()),
  getRefreshToken: jest.fn(() => Promise.resolve('r')),
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockSignup.mockClear();
  mockCreateFarm.mockClear();
});

it('creates the account + default-named farm, then routes to onboarding', async () => {
  await render(<SignupScreen />);
  fireEvent.changeText(screen.getByLabelText('Prénom'), 'Awa');
  fireEvent.changeText(screen.getByLabelText('Nom'), 'Diop');
  fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'awa@example.com');
  fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'password123');
  fireEvent.changeText(screen.getByLabelText('Confirmation'), 'password123');

  fireEvent.press(screen.getByLabelText('Créer mon compte'));

  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(onboarding)'));
  expect(mockSignup).toHaveBeenCalledTimes(1);
  expect(mockCreateFarm).toHaveBeenCalledWith({ name: 'Ferme de Awa' });
});
