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

import { useLocalSearchParams } from 'expo-router';
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

  /**
   * ADR-020: a medication is one product with two faces, and only the Sanitaire sheet can ask for
   * the withdrawal delays. Declaring one here as an ordinary "Produit" is how a pilot farm ended
   * up holding 3,5 L it could not select when recording a treatment, so the Stock screen says
   * where a medication is declared instead of letting the trap close again.
   */
  it('sends medications to Sanitaire from the Stock catalog', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValueOnce({ category: 'stock' });
    await render(<ReglagesCategory />);
    expect(screen.getByText(/médicament/i)).toBeTruthy();
  });

  it('says nothing about medications on an unrelated catalog', async () => {
    await render(<ReglagesCategory />);
    expect(screen.queryByText(/médicament/i)).toBeNull();
  });

  it('category screen renders the catalog manager for a declarative slug', async () => {
    await render(<ReglagesCategory />);
    // comptabilite -> expense_categories entry shows, plus the add affordance
    expect(screen.getByText('Aliment')).toBeTruthy();
    expect(screen.getByLabelText('Ajouter un élément')).toBeTruthy();
  });
});
