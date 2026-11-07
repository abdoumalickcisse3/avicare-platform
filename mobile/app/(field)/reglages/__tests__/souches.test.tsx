import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockRedirect = jest.fn((_href: string) => null);
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), back: jest.fn() })),
  Redirect: (props: { href: string }) => {
    mockRedirect(props.href);
    return null;
  },
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));

const mockFarmAccess: { current: { isAdmin: boolean; farmRole: string; session: unknown } } = {
  current: { isAdmin: false, farmRole: 'OWNER', session: { token: 'x' } },
};
jest.mock('@/auth/useSession', () => ({
  useFarmAccess: jest.fn(() => mockFarmAccess.current),
}));

const mockDeclareBreed = jest.fn(() => ({ unwrap: () => Promise.resolve({}) }));
const mockBreeds: { current: unknown[] } = { current: [] };
jest.mock('@/store/api/breedsApi', () => ({
  useListBreedsQuery: jest.fn(() => ({ data: mockBreeds.current })),
  useDeclareBreedMutation: jest.fn(() => [mockDeclareBreed, { isLoading: false }]),
}));

import SouchesScreen from '../souches';

function breed(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    species: 'POULTRY',
    code: 'cobb_500',
    name: 'Cobb 500',
    type: 'broiler',
    profile: 'BROILER_FAST',
    defaultTargetWeightG: 2300,
    defaultTargetAgeDays: 35,
    farmId: null,
    active: true,
    ...overrides,
  };
}

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });
const type = (el: Parameters<typeof fireEvent.changeText>[0], text: string): Promise<void> =>
  act(async () => {
    fireEvent.changeText(el, text);
  });

beforeEach(() => {
  mockRedirect.mockClear();
  mockDeclareBreed.mockClear();
  mockBreeds.current = [];
  mockFarmAccess.current = { isAdmin: false, farmRole: 'OWNER', session: { token: 'x' } };
});

describe("l'écran Souches n'est pas accessible à FARMER", () => {
  it('redirige un FARMER plutôt que de montrer un formulaire qui prendrait un 403', async () => {
    mockFarmAccess.current = { isAdmin: false, farmRole: 'FARMER', session: { token: 'x' } };
    await render(<SouchesScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/(field)/reglages');
  });

  it('laisse passer OWNER', async () => {
    await render(<SouchesScreen />);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('laisse passer MANAGER', async () => {
    mockFarmAccess.current = { isAdmin: false, farmRole: 'MANAGER', session: { token: 'x' } };
    await render(<SouchesScreen />);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe('liste des souches propres à la ferme', () => {
  it('affiche une souche propre à la ferme (farmId correspondant)', async () => {
    mockBreeds.current = [breed({ id: 9, name: 'Goliath', farmId: 7, profile: 'BROILER_RUSTIC', defaultTargetWeightG: null, defaultTargetAgeDays: null })];
    await render(<SouchesScreen />);
    expect(screen.getByText('Goliath')).toBeTruthy();
  });

  it('n\'affiche pas une souche de catalogue (plateforme, farmId null)', async () => {
    mockBreeds.current = [breed({ id: 1, name: 'Cobb 500', farmId: null })];
    await render(<SouchesScreen />);
    expect(screen.queryByText('Cobb 500')).toBeNull();
  });
});

describe('déclare une souche et la retrouve dans le sélecteur', () => {
  it('envoie uniquement {name, profile} — jamais de code ni de species', async () => {
    await render(<SouchesScreen />);

    await type(screen.getByLabelText('Nom de la souche'), 'Goliath');
    await press(screen.getByLabelText('Chair rustique (croissance lente)'));
    await press(screen.getByLabelText('Déclarer la souche'));

    expect(mockDeclareBreed).toHaveBeenCalledWith({
      farmId: 7,
      body: { name: 'Goliath', profile: 'BROILER_RUSTIC' },
    });
  });

  it('la liste se met à jour dès que la requête de souches se rafraîchit (pas un instantané figé)', async () => {
    const { rerender } = await render(<SouchesScreen />);
    expect(screen.queryByText('Goliath')).toBeNull();

    mockBreeds.current = [breed({ id: 9, name: 'Goliath', farmId: 7, profile: 'BROILER_RUSTIC', defaultTargetWeightG: null, defaultTargetAgeDays: null })];
    await act(async () => {
      await rerender(<SouchesScreen />);
    });

    expect(screen.getByText('Goliath')).toBeTruthy();
  });
});
