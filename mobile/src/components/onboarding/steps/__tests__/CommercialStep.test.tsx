import { render, screen } from '@testing-library/react-native';
import { CommercialStep } from '../CommercialStep';
import { WizardContext } from '@/onboarding/wizardContext';

jest.mock('@/store/api/catalogApi', () => ({
  useGetCatalogQuery: () => ({ data: [] }),
  useOverrideCatalogEntryMutation: () => [jest.fn(), {}],
  useDeleteCatalogEntryMutation: () => [jest.fn(), {}],
}));
jest.mock('@/store/api/clientsApi', () => ({
  useGetClientsQuery: () => ({ data: [] }),
  useCreateClientMutation: () => [jest.fn(() => ({ unwrap: () => Promise.resolve({}) })), {}],
}));

it('shows the commercial and clients sections', async () => {
  await render(
    <WizardContext.Provider value={{ farmId: 1, registerNext: jest.fn(), setCanAdvance: jest.fn() }}>
      <CommercialStep />
    </WizardContext.Provider>,
  );
  expect(screen.getByText('Configurez votre commercial')).toBeTruthy();
  expect(screen.getByText('Vos clients')).toBeTruthy();
});
