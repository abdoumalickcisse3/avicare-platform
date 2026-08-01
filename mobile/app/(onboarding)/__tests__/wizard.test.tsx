import { fireEvent, render, screen } from '@testing-library/react-native';
import OnboardingWizard from '../index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

// The screen resolves farmId from the farms list; the farm step also updates it.
jest.mock('@/store/api/farmsApi', () => ({
  useListFarmsQuery: () => ({
    data: [{ id: 1, name: 'Ferme Test', location: null, capacity: null, productionFocus: ['broiler'] }],
  }),
  useUpdateFarmMutation: () => [jest.fn(() => ({ unwrap: () => Promise.resolve({}) })), {}],
}));

describe('OnboardingWizard', () => {
  it('opens on the welcome panel', async () => {
    await render(<OnboardingWizard />);
    expect(screen.getByText('On configure votre ferme ensemble')).toBeTruthy();
  });

  it('advances from welcome to the farm panel', async () => {
    await render(<OnboardingWizard />);
    fireEvent.press(screen.getByText('Continuer'));
    expect(await screen.findByText('Parlez-nous de votre ferme')).toBeTruthy();
  });
});
