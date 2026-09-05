import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

jest.mock('expo-router', () => ({ useRouter: jest.fn(() => ({ back: jest.fn() })), Redirect: () => null }));
jest.mock('react-redux', () => ({ useSelector: jest.fn(() => 7), useDispatch: jest.fn(() => jest.fn()), useStore: jest.fn(() => ({})) }));
jest.mock('@/auth/useSession', () => ({ useFarmAccess: jest.fn(() => ({ can: () => true, isAdmin: true, farmRole: 'OWNER', session: null })) }));
jest.mock('@/store/api/feedFormulasApi', () => ({
  useGetAvailableFormulasQuery: jest.fn(() => ({
    data: {
      platformFormulas: [],
      farmFormulas: [
        { id: 1, farmId: 7, name: 'Ma ration démarrage', description: null, sourceFormulaKey: 'starter_std', targetBreedKeys: [], targetPhase: 'STARTER', targetAgeDaysMin: 0, targetAgeDaysMax: 21, ingredients: [{ articleKey: 'mais', articleSource: 'INVENTORY', percentage: 60 }, { articleKey: 'soja', articleSource: 'INVENTORY', percentage: 40 }], totalPercentage: 100, estimatedCostPer100kgXof: 21500, estimatedCostCalculatedAt: null, active: true, notes: null },
      ],
    },
    isLoading: false,
  })),
  useCloneFeedFormulaMutation: jest.fn(() => [jest.fn(() => ({ unwrap: () => Promise.resolve() })), { isLoading: false }]),
  useRecomputeFormulaCostMutation: jest.fn(() => [jest.fn(() => ({ unwrap: () => Promise.resolve() })), { isLoading: false }]),
  useDeactivateFeedFormulaMutation: jest.fn(() => [jest.fn(() => ({ unwrap: () => Promise.resolve() })), { isLoading: false }]),
}));
jest.mock('@/store/api/inventoryCatalogApi', () => ({
  useGetPlatformFormulasQuery: jest.fn(() => ({ data: [{ key: 'starter_std', label: 'Démarrage standard', targetBreedKeys: [], targetPhase: 'STARTER', targetAgeDaysMin: 0, targetAgeDaysMax: 21, ingredients: [], estimatedCostPer100kgXof: 20000 }] })),
  // The clone sheet reads the chosen template's composition; without this the screen throws.
  useGetPlatformFormulaQuery: jest.fn(() => ({
    data: {
      key: 'starter_std',
      label: 'Démarrage standard',
      targetBreedKeys: [],
      targetPhase: 'STARTER',
      targetAgeDaysMin: 0,
      targetAgeDaysMax: 21,
      ingredients: [
        { articleKey: 'corn_crushed', articleSource: 'INVENTORY', percentage: 60 },
        { articleKey: 'soybean_meal', articleSource: 'INVENTORY', percentage: 40 },
      ],
      estimatedCostPer100kgXof: 20000,
    },
  })),
}));

import FormulesScreen from '../formules';

describe('Formules', () => {
  it('shows farm formulas with phase, cost and ingredient count, then opens the clone sheet', async () => {
    await render(<FormulesScreen />);
    expect(screen.getByText('Ma ration démarrage')).toBeTruthy();
    expect(screen.getByText('Démarrage')).toBeTruthy(); // FEED_PHASE_LABELS.STARTER
    expect(screen.getByText('2 ingrédients · 100%')).toBeTruthy();

    await press(screen.getByLabelText('Cloner un modèle'));
    expect(screen.getByText('Démarrage standard')).toBeTruthy();
    expect(screen.getByLabelText('Nom')).toBeTruthy();
  });

  it('shows what the chosen template is made of before cloning it', async () => {
    // The list gives the phase and the cost; the composition — what the birds will actually eat —
    // only comes with the template itself, and picking a ration blind is picking their feed blind.
    await render(<FormulesScreen />);
    await press(screen.getByLabelText('Cloner un modèle'));
    await press(screen.getByLabelText('Démarrage standard'));

    expect(screen.getByText('Composition')).toBeTruthy();
    expect(screen.getByText('corn_crushed')).toBeTruthy();
    expect(screen.getByText('60 %')).toBeTruthy();
  });
});
