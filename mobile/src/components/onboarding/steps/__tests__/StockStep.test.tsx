import { render, screen } from '@testing-library/react-native';
import { StockStep } from '../StockStep';
import { WizardContext } from '@/onboarding/wizardContext';

jest.mock('@/store/api/catalogApi', () => ({
  useGetCatalogQuery: () => ({ data: [] }),
  useOverrideCatalogEntryMutation: () => [jest.fn(), {}],
  useDeleteCatalogEntryMutation: () => [jest.fn(), {}],
}));
jest.mock('@/store/api/suppliersApi', () => ({
  useGetSuppliersQuery: () => ({ data: [] }),
  useCreateSupplierMutation: () => [jest.fn(() => ({ unwrap: () => Promise.resolve({}) })), {}],
}));

it('shows the stock and suppliers sections', async () => {
  await render(
    <WizardContext.Provider value={{ farmId: 1, registerNext: jest.fn(), setCanAdvance: jest.fn() }}>
      <StockStep />
    </WizardContext.Provider>,
  );
  expect(screen.getByText('Configurez votre stock')).toBeTruthy();
  expect(screen.getByText('Vos fournisseurs')).toBeTruthy();
});
