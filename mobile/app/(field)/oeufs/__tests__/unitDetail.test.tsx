import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ unitId: '12' })),
  useRouter: jest.fn(() => ({ back: jest.fn(), push: jest.fn() })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));

// `can` accorde tout : c'est bien le RÔLE, et non la permission, qui doit décider ici.
const mockAccess = { can: () => true, isAdmin: false, farmRole: 'OWNER', session: null };
jest.mock('@/auth/useSession', () => ({ useFarmAccess: () => mockAccess }));

jest.mock('@/components/health/HealthSection', () => ({ HealthSection: () => null }));
jest.mock('@/components/layer/CloseDayButton', () => ({ CloseDayButton: () => null }));
jest.mock('@/components/charts/LayingRateCurve', () => ({ LayingRateCurve: () => null }));
jest.mock('@/components/charts/Production7dChart', () => ({ Production7dChart: () => null }));
jest.mock('@/components/charts/GradesDonut', () => ({ GradesDonut: () => null }));
jest.mock('@/components/charts/FlockCountCurve', () => ({ FlockCountCurve: () => null }));

jest.mock('@/store/api/productionUnitsApi', () => ({
  useListProductionUnitsQuery: jest.fn(() => ({ data: [{ id: 12, name: 'Pondeuses A', currentCount: 480 }] })),
  useGetUnitEventsQuery: jest.fn(() => ({ data: [] })),
}));
jest.mock('@/store/api/poultryBatchesApi', () => ({
  useGetDailyRecordsQuery: jest.fn(() => ({ data: [] })),
}));
const mockDeleteCollection = jest.fn(
  (_arg: { farmId: number; id: number; unitId: number }) => ({ unwrap: () => Promise.resolve() }),
);
jest.mock('@/store/api/eggProductionApi', () => ({
  useGetCollectionsQuery: jest.fn(() => ({
    data: [
      { id: 5, unitId: 12, collectionDate: '2026-09-05', timeslotKey: 'matin', totalEggs: 320, brokenEggs: 4, gradesCount: {} },
    ],
  })),
  useGetDailyProductionsQuery: jest.fn(() => ({ data: [] })),
  useGetRollingRateQuery: jest.fn(() => ({ data: undefined })),
  useGetTrayStockQuery: jest.fn(() => ({ data: undefined })),
  useDeleteCollectionMutation: jest.fn(() => [mockDeleteCollection, { isLoading: false }]),
}));

import LayerUnitScreen from '../[unitId]';

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockAccess.farmRole = 'OWNER';
  mockAccess.isAdmin = false;
  mockDeleteCollection.mockClear();
});
afterEach(() => jest.restoreAllMocks());

describe('Lot de ponte — suppression d\'une collecte', () => {
  /**
   * Saisir une collecte est un geste de terrain (`poultry:write`, que porte un FARMER) ; la
   * supprimer est un geste de supervision, réservé OWNER/MANAGER côté backend
   * (`LayerAccess.WRITE_MANAGER`).
   */
  it('est offerte au propriétaire, et nomme les œufs qui sortent de la production', async () => {
    await render(<LayerUnitScreen />);
    await press(screen.getByText('Collectes'));

    await press(screen.getByLabelText('Supprimer la collecte du 2026-09-05 matin'));

    // La confirmation nomme la conséquence : ce n'est pas qu'une ligne d'historique.
    const [title, message] = (Alert.alert as unknown as jest.Mock).mock.calls.at(-1) as string[];
    expect(title).toBe('Supprimer cette collecte ?');
    expect(message).toMatch(/320 œufs du 2026-09-05/);
  });

  it('est refusée à un ouvrier, malgré poultry:write', async () => {
    mockAccess.farmRole = 'FARMER';
    await render(<LayerUnitScreen />);
    await press(screen.getByText('Collectes'));

    // La collecte reste lisible : c'est la corbeille qui disparaît, pas la donnée.
    expect(screen.getByText(/2026-09-05/)).toBeTruthy();
    expect(screen.queryByLabelText('Supprimer la collecte du 2026-09-05 matin')).toBeNull();
  });
});
