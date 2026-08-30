/**
 * The formula editor: the pinned numbers, and the rule that a total ≠ 100 % never blocks.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { FarmFeedFormula, InventoryCatalogItem } from '@/types';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const mockArticles: InventoryCatalogItem[] = [
  { articleKey: 'mais', articleSource: 'INVENTORY', label: 'Maïs', subcategory: null, unit: 'kg', typicalUnitPriceXof: 300, custom: false },
  { articleKey: 'tourteau', articleSource: 'INVENTORY', label: 'Tourteau de soja', subcategory: null, unit: 'kg', typicalUnitPriceXof: 500, custom: false },
  { articleKey: 'coquille', articleSource: 'INVENTORY', label: 'Coquilles', subcategory: null, unit: 'kg', typicalUnitPriceXof: null, custom: true },
];

const mockFormula: FarmFeedFormula = {
  id: 3,
  farmId: 7,
  name: 'Démarrage maison',
  description: null,
  sourceFormulaKey: null,
  targetBreedKeys: [],
  targetPhase: 'STARTER',
  targetAgeDaysMin: null,
  targetAgeDaysMax: null,
  ingredients: [
    { articleKey: 'mais', articleSource: 'INVENTORY', percentage: 60 },
    { articleKey: 'tourteau', articleSource: 'INVENTORY', percentage: 36 },
  ],
  totalPercentage: 96,
  estimatedCostPer100kgXof: null,
  estimatedCostCalculatedAt: null,
  active: true,
  notes: null,
};

const mockCreate = jest.fn(() => ({ unwrap: () => Promise.resolve({}) }));
const mockUpdate = jest.fn(() => ({ unwrap: () => Promise.resolve({}) }));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ formulaId: '3' }),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
jest.mock('@/auth/useSession', () => ({
  useFarmAccess: () => ({ can: () => true, isAdmin: true, farmRole: 'OWNER', session: null }),
}));
jest.mock('@/store/api/feedFormulasApi', () => ({
  useGetFeedFormulaQuery: () => ({ data: mockFormula }),
  useCreateFeedFormulaMutation: () => [mockCreate, { isLoading: false }],
  useUpdateFeedFormulaMutation: () => [mockUpdate, { isLoading: false }],
}));
jest.mock('@/store/api/inventoryCatalogApi', () => ({
  useGetAllArticlesQuery: () => ({ data: mockArticles }),
}));

// eslint-disable-next-line import/first
import FormulaEditorScreen from '../formule-edition';

beforeEach(() => jest.clearAllMocks());

describe('FormulaEditorScreen', () => {
  it('pins the total and the cost, the two numbers being aimed at', async () => {
    await render(<FormulaEditorScreen />);

    expect(screen.getByLabelText('Total des parts')).toBeTruthy();
    // 60 kg × 300 + 36 kg × 500 = 36 000.
    expect(screen.getByText(/36[\s ]?000/)).toBeTruthy();
  });

  it('reports the gap to 100 % and says it is not blocking', async () => {
    await render(<FormulaEditorScreen />);

    expect(screen.getByText(/Il manque 4 %/)).toBeTruthy();
    expect(screen.getByText(/enregistrer quand même/)).toBeTruthy();
  });

  it('saves a formula that does not total 100 %, which the backend accepts', async () => {
    await render(<FormulaEditorScreen />);

    await press(screen.getByLabelText('Enregistrer la formule'));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ farmId: 7, id: 3 }),
    );
  });

  it('closes the gap in one tap, proportionally', async () => {
    await render(<FormulaEditorScreen />);

    await press(screen.getByLabelText("Répartir jusqu'à 100 %"));

    expect(screen.queryByText(/Il manque/)).toBeNull();
  });

  it('shows each share as the kilograms it represents in 100 kg', async () => {
    await render(<FormulaEditorScreen />);

    expect(screen.getByText('60 kg pour 100 kg')).toBeTruthy();
  });

  it('offers only articles not already in the formula', async () => {
    await render(<FormulaEditorScreen />);

    await press(screen.getByLabelText('Ajouter un ingrédient'));

    expect(screen.getByLabelText('Ajouter Coquilles')).toBeTruthy();
    expect(screen.queryByLabelText('Ajouter Maïs')).toBeNull();
  });

  it('marks an article with no price, since one of them makes the cost unknowable', async () => {
    await render(<FormulaEditorScreen />);

    await press(screen.getByLabelText('Ajouter un ingrédient'));

    expect(screen.getByText('sans prix')).toBeTruthy();
  });
});
