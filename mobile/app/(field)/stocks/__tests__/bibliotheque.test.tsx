import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const type = (el: Parameters<typeof fireEvent.changeText>[0], text: string): Promise<void> =>
  act(async () => {
    fireEvent.changeText(el, text);
  });

const mockCreate = jest.fn(() => ({ unwrap: () => Promise.resolve() }));

beforeEach(() => mockCreate.mockClear());

jest.mock('expo-router', () => ({ useRouter: jest.fn(() => ({ back: jest.fn() })), Redirect: () => null }));
jest.mock('react-redux', () => ({ useSelector: jest.fn(() => 7), useDispatch: jest.fn(() => jest.fn()), useStore: jest.fn(() => ({})) }));
jest.mock('@/auth/useSession', () => ({ useFarmAccess: jest.fn(() => ({ can: () => true, isAdmin: true, farmRole: 'OWNER', session: null })) }));
jest.mock('@/store/api/inventoryCatalogApi', () => ({
  useGetInventoryArticlesQuery: jest.fn(() => ({
    data: [
      { articleKey: 'mais', articleSource: 'INVENTORY', label: 'Maïs concassé', subcategory: 'FEED', unit: 'kg', typicalUnitPriceXof: 250, custom: false },
      { articleKey: 'mix', articleSource: 'INVENTORY', label: 'Mix perso', subcategory: 'FEED', unit: 'sac', typicalUnitPriceXof: null, custom: true },
    ],
    isLoading: false,
  })),
  useCreateArticleMutation: jest.fn(() => [mockCreate, { isLoading: false }]),
  useDeleteArticleMutation: jest.fn(() => [jest.fn(() => ({ unwrap: () => Promise.resolve() })), { isLoading: false }]),
}));

import BibliothequeScreen from '../bibliotheque';

describe('Bibliothèque', () => {
  it('lists articles with a Perso badge and opens the add sheet', async () => {
    await render(<BibliothequeScreen />);
    expect(screen.getByText('Maïs concassé')).toBeTruthy();
    expect(screen.getByText('Mix perso')).toBeTruthy();
    expect(screen.getByText('Perso')).toBeTruthy();

    await press(screen.getByLabelText('Nouvel article'));
    expect(screen.getByLabelText('Nom')).toBeTruthy();
    expect(screen.getByLabelText('Unité')).toBeTruthy();
  });

  it("n'offre « Modifier » que sur un article perso", async () => {
    // Même règle que le web : on ne modifie pas un article de la plateforme.
    await render(<BibliothequeScreen />);

    expect(screen.getByLabelText('Modifier Mix perso')).toBeTruthy();
    expect(screen.queryByLabelText('Modifier Maïs concassé')).toBeNull();
  });

  it('renomme un article SANS en créer un second', async () => {
    // Le catalogue est un upsert : c'est la clé qui décide. Renommer en repartant du slug du
    // nouveau libellé forkerait l'article, et le stock déjà saisi resterait sur l'ancienne clé.
    await render(<BibliothequeScreen />);

    await press(screen.getByLabelText('Modifier Mix perso'));
    await type(screen.getByLabelText('Nom'), 'Mix maison');
    await press(screen.getByLabelText("Enregistrer l'article"));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ farmId: 7, key: 'mix' }),
    );
    expect(mockCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ key: 'mix-maison' }),
    );
  });

  it("préremplit la feuille avec les valeurs de l'article", async () => {
    await render(<BibliothequeScreen />);

    await press(screen.getByLabelText('Modifier Mix perso'));

    expect(screen.getByLabelText('Nom').props.value).toBe('Mix perso');
    expect(screen.getByLabelText('Unité').props.value).toBe('sac');
  });
});
