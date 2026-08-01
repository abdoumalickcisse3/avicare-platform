import { render, screen } from '@testing-library/react-native';
import { LivestockStep } from '../LivestockStep';
import { WizardContext } from '@/onboarding/wizardContext';

jest.mock('@/store/api/farmsApi', () => ({
  useListFarmsQuery: () => ({ data: [{ id: 1, name: 'F', productionFocus: ['broiler'] }] }),
}));
jest.mock('@/store/api/breedsApi', () => ({
  useListBreedsQuery: () => ({ data: [{ id: 9, name: 'Cobb 500', type: 'broiler', species: 'POULTRY' }] }),
}));
jest.mock('@/store/api/poultryBatchesApi', () => ({
  useGetBatchesQuery: () => ({ data: [] }),
  useCreateBatchMutation: () => [jest.fn(() => ({ unwrap: () => Promise.resolve({}) })), {}],
}));
jest.mock('@/store/api/productionUnitsApi', () => ({
  useListProductionUnitsQuery: () => ({ data: [] }),
  useCreateProductionUnitMutation: () => [jest.fn(() => ({ unwrap: () => Promise.resolve({}) })), {}],
}));

function renderStep(setCanAdvance = jest.fn()) {
  return render(
    <WizardContext.Provider value={{ farmId: 1, registerNext: jest.fn(), setCanAdvance }}>
      <LivestockStep />
    </WizardContext.Provider>,
  );
}

describe('LivestockStep', () => {
  it('gates a broiler-only farm until a lot exists', async () => {
    const setCanAdvance = jest.fn();
    await renderStep(setCanAdvance);
    expect(setCanAdvance).toHaveBeenCalledWith(false);
    expect(screen.getByText('Poulets de chair')).toBeTruthy();
    expect(screen.getByText('Ajoutez au moins un lot pour continuer.')).toBeTruthy();
  });

  it('does not show the layer section for a broiler-only farm', async () => {
    await renderStep();
    expect(screen.queryByText('Poules pondeuses')).toBeNull();
  });
});
