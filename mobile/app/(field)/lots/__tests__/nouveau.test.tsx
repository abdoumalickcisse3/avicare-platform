import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const type = (el: Parameters<typeof fireEvent.changeText>[0], text: string): Promise<void> =>
  act(async () => {
    fireEvent.changeText(el, text);
  });

const mockCreateBatch = jest.fn((_args: { farmId: number; body: Record<string, unknown> }) => ({
  unwrap: () => Promise.resolve({ id: 1 }),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
jest.mock('@/store/api/breedsApi', () => ({
  useListBreedsQuery: jest.fn(() => ({
    data: [
      { id: 1, species: 'POULTRY', code: 'RIR', name: 'Ross 308', type: 'broiler', farmId: null, active: true },
      { id: 2, species: 'POULTRY', code: 'LEG', name: 'Leghorn', type: 'layer', farmId: null, active: true },
    ],
  })),
}));
jest.mock('@/store/api/poultryBatchesApi', () => ({
  useCreateBatchMutation: jest.fn(() => [mockCreateBatch, { isLoading: false }]),
}));

import CreerBandeScreen from '../nouveau';

describe('Nouvelle bande', () => {
  beforeEach(() => mockCreateBatch.mockClear());

  it('crée une bande avec le prix des poussins renseigné', async () => {
    await render(<CreerBandeScreen />);
    await type(screen.getByLabelText('Effectif'), '500');
    await type(screen.getByLabelText('Prix par poussin (FCFA, optionnel)'), '300');
    await press(screen.getByLabelText('Créer le lot'));
    expect(mockCreateBatch).toHaveBeenCalledWith({
      farmId: 7,
      body: expect.objectContaining({
        initialCount: 500,
        chickUnitPriceXof: 300,
      }),
    });
  });

  it('crée une bande sans prix des poussins (facultatif)', async () => {
    await render(<CreerBandeScreen />);
    await type(screen.getByLabelText('Effectif'), '500');
    await press(screen.getByLabelText('Créer le lot'));
    expect(mockCreateBatch).toHaveBeenCalledTimes(1);
    const body = mockCreateBatch.mock.calls[0]?.[0].body;
    expect(body).not.toHaveProperty('chickUnitPriceXof');
  });
});
