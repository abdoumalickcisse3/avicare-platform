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
});
