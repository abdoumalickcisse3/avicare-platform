import { render, screen } from '@testing-library/react-native';
import { FinanceStep } from '../FinanceStep';
import { WizardContext } from '@/onboarding/wizardContext';

jest.mock('@/store/api/catalogApi', () => ({
  useGetCatalogQuery: () => ({ data: [] }),
  useOverrideCatalogEntryMutation: () => [jest.fn(), {}],
  useDeleteCatalogEntryMutation: () => [jest.fn(), {}],
}));

it('shows the expense-categories step', async () => {
  await render(
    <WizardContext.Provider value={{ farmId: 1, registerNext: jest.fn(), setCanAdvance: jest.fn() }}>
      <FinanceStep />
    </WizardContext.Provider>,
  );
  expect(screen.getByText('Configurez vos dépenses')).toBeTruthy();
});
