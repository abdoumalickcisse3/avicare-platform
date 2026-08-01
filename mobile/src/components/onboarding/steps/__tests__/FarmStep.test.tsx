import { fireEvent, render, screen } from '@testing-library/react-native';
import { FarmStep } from '../FarmStep';
import { WizardContext } from '@/onboarding/wizardContext';

jest.mock('@/store/api/farmsApi', () => ({
  useListFarmsQuery: () => ({
    data: [{ id: 1, name: 'Ferme Ndiaye', location: null, capacity: null, productionFocus: ['broiler'] }],
  }),
  useUpdateFarmMutation: () => [jest.fn(() => ({ unwrap: () => Promise.resolve({}) })), {}],
}));

function renderStep() {
  return render(
    <WizardContext.Provider value={{ farmId: 1, registerNext: jest.fn(), setCanAdvance: jest.fn() }}>
      <FarmStep />
    </WizardContext.Provider>,
  );
}

describe('FarmStep', () => {
  it('prefills the farm name and shows the production-type cards', async () => {
    await renderStep();
    expect(screen.getByDisplayValue('Ferme Ndiaye')).toBeTruthy();
    for (const t of ['Chair', 'Ponte', 'Mixte']) expect(screen.getByText(t)).toBeTruthy();
  });

  it('lets the user pick a production type', async () => {
    await renderStep();
    fireEvent.press(screen.getByText('Ponte'));
    expect(screen.getByLabelText('Ponte')).toBeTruthy();
  });
});
