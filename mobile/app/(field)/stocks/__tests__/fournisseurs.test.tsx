import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ back: jest.fn(), push: jest.fn() })),
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
  useGetSuppliersQuery: jest.fn(() => ({
    data: [{ id: 2, commercialName: 'Sénégal Aliments', phone: '77 123 45 67', notifyWhatsapp: false }],
    isLoading: false,
  })),
  useCreateSupplierMutation: jest.fn(() => [jest.fn(), { isLoading: false }]),
}));
jest.mock('@/store/api/supplierLedgerApi', () => ({
  useGetSupplierBalancesQuery: jest.fn(() => ({ data: [{ supplierId: 2, supplierName: 'Sénégal Aliments', balanceXof: 15000 }] })),
}));

import FournisseursScreen from '../fournisseurs';

describe('Fournisseurs list', () => {
  it('lists suppliers with their balance and offers to add one', async () => {
    await render(<FournisseursScreen />);
    expect(screen.getByText('Sénégal Aliments')).toBeTruthy();
    expect(screen.getByText('Solde 15 000 F')).toBeTruthy();
    expect(screen.getByLabelText('Ajouter un fournisseur')).toBeTruthy();
    expect(screen.getByLabelText('Fiche de Sénégal Aliments')).toBeTruthy();
  });
});
