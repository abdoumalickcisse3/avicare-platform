import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ back: jest.fn() })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
jest.mock('@/auth/useSession', () => ({
  useFarmAccess: jest.fn(() => ({ farmRole: 'OWNER', can: () => true, isAdmin: true, session: null })),
}));
jest.mock('@/store/api/suppliersApi', () => ({
  useGetSuppliersQuery: jest.fn(() => ({ data: [{ id: 2, commercialName: 'Sénégal Aliments', phone: '77 123 45 67' }], isLoading: false })),
  useCreateSupplierMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
}));

import FournisseursScreen from '../fournisseurs';

describe('Fournisseurs list', () => {
  it('lists suppliers and offers to add one', async () => {
    await render(<FournisseursScreen />);
    expect(screen.getByText('Sénégal Aliments')).toBeTruthy();
    expect(screen.getByLabelText('Ajouter un fournisseur')).toBeTruthy();
  });
});
