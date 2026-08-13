import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const mockCreate = jest.fn(() => ({ unwrap: () => Promise.resolve() }));

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
});
