import { fireEvent, render, screen } from '@testing-library/react-native';
import OnboardingWizard from '../index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

// The screen resolves farmId from the farms list; mock the hook so it renders
// without a real store.
jest.mock('@/store/api/farmsApi', () => ({
  useListFarmsQuery: () => ({
    data: [{ id: 1, name: 'Ferme Test', productionFocus: ['broiler'] }],
  }),
}));

describe('OnboardingWizard', () => {
  it('opens on the welcome panel', async () => {
    await render(<OnboardingWizard />);
    expect(screen.getByText('Bienvenue sur Jawdi')).toBeTruthy();
  });

  it('advances from welcome to the farm panel', async () => {
    await render(<OnboardingWizard />);
    fireEvent.press(screen.getByText('Continuer'));
    expect(await screen.findByText('Votre ferme')).toBeTruthy();
  });
});
