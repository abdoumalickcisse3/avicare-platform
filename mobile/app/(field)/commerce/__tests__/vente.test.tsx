import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const mockCreateSale = jest.fn(() => ({ unwrap: () => Promise.resolve({ id: 1, totalXof: 0 }) }));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
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
jest.mock('@/auth/useSession', () => ({
  useFarmAccess: jest.fn(() => ({ farmRole: 'OWNER', can: () => true, isAdmin: true, session: null })),
}));
jest.mock('@/commerce/useProductionAvailability', () => ({
  useProductionAvailability: jest.fn(() => ({
    broilerLots: [{ unitId: 5, label: 'Lot A', heads: 100 }],
    eggsAvailable: 0,
    loading: false,
  })),
}));
jest.mock('@/store/api/clientsApi', () => ({ useGetClientsQuery: jest.fn(() => ({ data: [] })) }));
jest.mock('@/store/api/catalogApi', () => ({ useGetCatalogQuery: jest.fn(() => ({ data: [] })) }));
jest.mock('@/store/api/salesApi', () => ({
  useCreateSaleMutation: jest.fn(() => [mockCreateSale, { isLoading: false }]),
}));

const mockFetchPerformance = jest.fn(() => ({
  unwrap: () =>
    Promise.resolve({
      poultryBatchId: 5,
      snapshotDate: '2026-09-20',
      currentWeightG: 1800,
      ageDays: 30,
      gmqGPerDay: 60,
      feedConversionRatio: 1.8,
      cumulativeMortalityPercent: 2,
      cumulativeFeedKg: 90,
      forecastedTargetDate: null,
      performanceScore: 'ON_TARGET',
    }),
}));
jest.mock('@/store/api/poultryBatchesApi', () => ({
  useLazyGetPerformanceQuery: jest.fn(() => [mockFetchPerformance]),
}));

import VenteScreen from '../vente';

describe('Vente directe', () => {
  beforeEach(() => mockCreateSale.mockClear());

  it('adds a broiler lot and submits a walk-in cash sale', async () => {
    await render(<VenteScreen />);
    await press(screen.getByLabelText('Ajouter Lot A à la vente'));
    await press(screen.getByLabelText('Valider la vente'));
    expect(mockCreateSale).toHaveBeenCalledWith({
      farmId: 7,
      body: expect.objectContaining({
        clientId: null,
        paymentMethod: 'CASH',
        lines: [
          expect.objectContaining({
            articleKey: 'BROILER',
            articleSource: 'PRODUCTION',
            productType: 'BROILER',
            productionUnitId: 5,
            quantity: 1,
          }),
        ],
      }),
    });
  });

  it('bascule en mode au poids, pré-remplit le poids et envoie weightKg', async () => {
    await render(<VenteScreen />);
    await press(screen.getByLabelText('Ajouter Lot A à la vente'));
    await press(screen.getByLabelText('Au poids — Lot A'));

    const weightInput = await screen.findByLabelText('Poids total (kg) — Lot A');
    await fireEvent.changeText(weightInput, '30.5');

    await press(screen.getByLabelText('Valider la vente'));

    expect(mockCreateSale).toHaveBeenCalledWith({
      farmId: 7,
      body: expect.objectContaining({
        lines: [expect.objectContaining({ weightKg: 30.5, quantity: 1 })],
      }),
    });
  });

  it('accepte une saisie décimale frappe par frappe : 3 → 30 → 30. → 30.5, et envoie 30.5', async () => {
    await render(<VenteScreen />);
    await press(screen.getByLabelText('Ajouter Lot A à la vente'));
    await press(screen.getByLabelText('Au poids — Lot A'));

    const weightInput = await screen.findByLabelText('Poids total (kg) — Lot A');

    // Chaque frappe est un événement distinct — c'est le vrai chemin de l'éleveur,
    // celui où « 30. » devenait « 30 » puis « 305 » (surfacturation ×10).
    await act(async () => fireEvent.changeText(weightInput, '3'));
    expect(screen.getByLabelText('Poids total (kg) — Lot A').props.value).toBe('3');
    await act(async () => fireEvent.changeText(weightInput, '30'));
    expect(screen.getByLabelText('Poids total (kg) — Lot A').props.value).toBe('30');
    await act(async () => fireEvent.changeText(weightInput, '30.'));
    // L'état intermédiaire survit : le point n'est plus avalé.
    expect(screen.getByLabelText('Poids total (kg) — Lot A').props.value).toBe('30.');
    await act(async () => fireEvent.changeText(weightInput, '30.5'));
    expect(screen.getByLabelText('Poids total (kg) — Lot A').props.value).toBe('30.5');

    await press(screen.getByLabelText('Valider la vente'));

    // Ni 305, ni NaN, ni 0.
    expect(mockCreateSale).toHaveBeenCalledWith({
      farmId: 7,
      body: expect.objectContaining({
        lines: [expect.objectContaining({ weightKg: 30.5, quantity: 1 })],
      }),
    });
  });

  it('accepte la virgule décimale (clavier fr-SN) sans la faire disparaître : 30,5 → 30.5', async () => {
    await render(<VenteScreen />);
    await press(screen.getByLabelText('Ajouter Lot A à la vente'));
    await press(screen.getByLabelText('Au poids — Lot A'));

    const weightInput = await screen.findByLabelText('Poids total (kg) — Lot A');

    // Le clavier décimal fr-SN produit une virgule, pas un point : elle ne doit
    // jamais être avalée par le filtre — sinon "30,5" devient silencieusement "305".
    await act(async () => fireEvent.changeText(weightInput, '30,5'));
    expect(screen.getByLabelText('Poids total (kg) — Lot A').props.value).toBe('30.5');

    await press(screen.getByLabelText('Valider la vente'));

    expect(mockCreateSale).toHaveBeenCalledWith({
      farmId: 7,
      body: expect.objectContaining({
        lines: [expect.objectContaining({ weightKg: 30.5, quantity: 1 })],
      }),
    });
  });

  it('bloque la validation tant que le poids est vide en mode au poids', async () => {
    await render(<VenteScreen />);
    await press(screen.getByLabelText('Ajouter Lot A à la vente'));
    await press(screen.getByLabelText('Au poids — Lot A'));

    const weightInput = await screen.findByLabelText('Poids total (kg) — Lot A');
    await act(async () => fireEvent.changeText(weightInput, ''));

    expect(screen.getByText(/Poids requis/)).toBeTruthy();
    await press(screen.getByLabelText('Valider la vente'));
    expect(mockCreateSale).not.toHaveBeenCalled();
  });

  it('recalcule le poids suggéré quand le nombre de têtes change après la bascule', async () => {
    await render(<VenteScreen />);
    await press(screen.getByLabelText('Ajouter Lot A à la vente'));
    await press(screen.getByLabelText('Au poids — Lot A'));

    // 1 tête × 1800 g = 1.8 kg suggéré…
    expect(screen.getByLabelText('Poids total (kg) — Lot A').props.value).toBe('1.8');
    // …puis 2 têtes → 3.6 kg, la suggestion suit.
    await press(screen.getByLabelText('Augmenter Lot A'));
    expect(screen.getByLabelText('Poids total (kg) — Lot A').props.value).toBe('3.6');
  });

  it("n'écrase jamais un poids saisi par l'éleveur quand la quantité change", async () => {
    await render(<VenteScreen />);
    await press(screen.getByLabelText('Ajouter Lot A à la vente'));
    await press(screen.getByLabelText('Au poids — Lot A'));

    const weightInput = await screen.findByLabelText('Poids total (kg) — Lot A');
    await act(async () => fireEvent.changeText(weightInput, '42.5'));

    await press(screen.getByLabelText('Augmenter Lot A'));
    // Une vraie pesée saisie reste la vérité.
    expect(screen.getByLabelText('Poids total (kg) — Lot A').props.value).toBe('42.5');
  });
});
