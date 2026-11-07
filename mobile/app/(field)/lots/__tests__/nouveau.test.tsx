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
      {
        id: 1,
        species: 'POULTRY',
        code: 'RIR',
        name: 'Ross 308',
        type: 'broiler',
        profile: 'BROILER_FAST',
        defaultTargetWeightG: 2300,
        defaultTargetAgeDays: 35,
        farmId: null,
        active: true,
      },
      {
        id: 2,
        species: 'POULTRY',
        code: 'LEG',
        name: 'Leghorn',
        type: 'layer',
        profile: 'LAYER_INDUSTRIAL',
        defaultTargetWeightG: null,
        defaultTargetAgeDays: null,
        farmId: null,
        active: true,
      },
      {
        id: 3,
        species: 'POULTRY',
        code: 'rustic',
        name: 'Locale rustique',
        type: 'broiler',
        profile: 'BROILER_RUSTIC',
        defaultTargetWeightG: null,
        defaultTargetAgeDays: null,
        farmId: null,
        active: true,
      },
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

  it('pré-remplit les cibles depuis le profil de la souche choisie par défaut, sans valeur en dur', async () => {
    await render(<CreerBandeScreen />);
    // Ross 308 is first in the list and selected automatically.
    expect(screen.getByLabelText('Poids cible (g)').props.value).toBe('2300');
    expect(screen.getByLabelText('Âge cible (jours)').props.value).toBe('35');
  });

  it('change les champs cible quand une autre souche est choisie', async () => {
    await render(<CreerBandeScreen />);
    await press(screen.getByLabelText('Locale rustique'));
    // No default declared for this profile: left empty rather than inventing a number.
    expect(screen.getByLabelText('Poids cible (g)').props.value).toBe('');
    expect(screen.getByLabelText('Âge cible (jours)').props.value).toBe('');
  });

  it("envoie les cibles du profil de la souche sélectionnée, pas un lot sans cible", async () => {
    await render(<CreerBandeScreen />);
    await type(screen.getByLabelText('Effectif'), '500');
    await press(screen.getByLabelText('Créer le lot'));
    expect(mockCreateBatch).toHaveBeenCalledWith({
      farmId: 7,
      body: expect.objectContaining({ targetWeightG: 2300, targetAgeDays: 35 }),
    });
  });

  it('omet les champs cible quand la souche choisie n\'en déclare aucun', async () => {
    await render(<CreerBandeScreen />);
    await press(screen.getByLabelText('Locale rustique'));
    await type(screen.getByLabelText('Effectif'), '500');
    await press(screen.getByLabelText('Créer le lot'));
    const body = mockCreateBatch.mock.calls[0]?.[0].body;
    expect(body).not.toHaveProperty('targetWeightG');
    expect(body).not.toHaveProperty('targetAgeDays');
  });
});
