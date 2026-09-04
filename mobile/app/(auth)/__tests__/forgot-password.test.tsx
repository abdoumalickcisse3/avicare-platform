import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ForgotPasswordScreen from '../forgot-password';

// React 19 + RNTL 14: fireEvent schedules a state update that is not flushed by the time it
// returns, so each interaction is wrapped in an async act. Without it the two-step screen never
// advances, and a promise that settles after the test ends leaks into the next one.
const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const type = (el: Parameters<typeof fireEvent.changeText>[0], text: string): Promise<void> =>
  act(async () => {
    fireEvent.changeText(el, text);
  });

const mockReplace = jest.fn();
const mockRequest = jest.fn(() => ({ unwrap: () => Promise.resolve({ message: 'ok' }) }));
const mockConfirm = jest.fn(() => ({ unwrap: () => Promise.resolve({ message: 'ok' }) }));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: jest.fn() }),
}));
jest.mock('@/store/api/authApi', () => ({
  useRequestPasswordResetMutation: () => [mockRequest, { isLoading: false }],
  useConfirmPasswordResetMutation: () => [mockConfirm, { isLoading: false }],
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockRequest.mockClear();
  mockConfirm.mockClear();
});

/** Walks step 1 and leaves the screen on the code step. */
async function askForACode(phone = '+221771234567') {
  await render(<ForgotPasswordScreen />);
  await type(screen.getByLabelText('Numéro de téléphone'), phone);
  await press(screen.getByLabelText('Recevoir un code'));
}

it('asks the backend for a code instead of pretending one was sent', async () => {
  await askForACode();

  expect(mockRequest).toHaveBeenCalledWith({ phone: '+221771234567' });
  expect(screen.getByLabelText('Code à 6 chiffres')).toBeTruthy();
});

it('sends the code and the new password, then confirms the change', async () => {
  await askForACode();

  await type(screen.getByLabelText('Code à 6 chiffres'), '123456');
  await type(screen.getByLabelText('Nouveau mot de passe'), 'nouveaupass');
  await press(screen.getByLabelText('Changer mon mot de passe'));

  expect(mockConfirm).toHaveBeenCalledWith({
    phone: '+221771234567',
    code: '123456',
    newPassword: 'nouveaupass',
  });
  expect(screen.getByText('Mot de passe modifié')).toBeTruthy();
});

it('moves on to the code step even when the number is unknown', async () => {
  mockRequest.mockImplementationOnce(() => ({
    unwrap: () => Promise.reject({ status: 404 }),
  }));

  await askForACode('+221770000000');

  // A known and an unknown number must be indistinguishable, or the screen becomes a way to
  // test whether an account exists.
  expect(screen.getByLabelText('Code à 6 chiffres')).toBeTruthy();
});

it('says the code was refused rather than failing silently', async () => {
  mockConfirm.mockImplementationOnce(() => ({
    unwrap: () => Promise.reject({ status: 400 }),
  }));

  await askForACode();
  await type(screen.getByLabelText('Code à 6 chiffres'), '000000');
  await type(screen.getByLabelText('Nouveau mot de passe'), 'nouveaupass');
  await press(screen.getByLabelText('Changer mon mot de passe'));

  expect(screen.getByText('Code incorrect ou expiré. Demandez-en un nouveau.')).toBeTruthy();
});
