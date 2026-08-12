import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), back: jest.fn() })),
  useLocalSearchParams: jest.fn(() => ({ category: 'comptabilite' })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({ useSelector: jest.fn(() => 7), useDispatch: jest.fn(() => jest.fn()), useStore: jest.fn(() => ({})) }));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/auth/useSession', () => ({ useFarmAccess: jest.fn(() => ({ isAdmin: true, can: () => true, farmRole: 'OWNER', session: null })) }));
jest.mock('@/store/api/catalogApi', () => ({
  useGetCatalogQuery: jest.fn(() => ({ data: [{ key: 'aliment', value: { label: 'Aliment' }, custom: false }] })),
  useOverrideCatalogEntryMutation: jest.fn(() => [jest.fn(() => ({ unwrap: () => Promise.resolve() })), {}]),
  useDeleteCatalogEntryMutation: jest.fn(() => [jest.fn(() => ({ unwrap: () => Promise.resolve() })), {}]),
}));
jest.mock('@/store/api/healthApi', () => ({
  useGetVaccinesQuery: jest.fn(() => ({ data: [{ key: 'newcastle' }] })),
  useGetTreatmentCatalogQuery: jest.fn(() => ({ data: [] })),
}));

import { useFarmAccess } from '@/auth/useSession';
import ReglagesHub from '../index';
import ReglagesCategory from '../[category]';

describe('Réglages', () => {
  it('hub renders while the session is still loading (no flash-redirect)', async () => {
    (useFarmAccess as jest.Mock).mockReturnValueOnce({ isAdmin: false, can: () => false, farmRole: undefined, session: null });
    await render(<ReglagesHub />);
    expect(screen.getByText('Stock')).toBeTruthy();
  });

  it('hub lists the five settings categories', async () => {
    await render(<ReglagesHub />);
    for (const name of ['Stock', 'Lots', 'Sanitaire', 'Ventes', 'Comptabilité']) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(screen.getByLabelText('Gérer Lots')).toBeTruthy();
  });

  it('category screen renders the catalog manager for a declarative slug', async () => {
    await render(<ReglagesCategory />);
    // comptabilite -> expense_categories entry shows, plus the add affordance
    expect(screen.getByText('Aliment')).toBeTruthy();
    expect(screen.getByLabelText('Ajouter un élément')).toBeTruthy();
  });
});
