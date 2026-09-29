import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ useRouter: jest.fn(() => ({ push: jest.fn() })) }));
jest.mock('react-redux', () => ({ useSelector: jest.fn(() => 7), useDispatch: jest.fn(() => jest.fn()), useStore: jest.fn(() => ({})) }));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/components/charts/Sparkline', () => ({ Sparkline: () => null }));
jest.mock('@/components/assistant/MicButton', () => ({ MicButton: () => null }));
jest.mock('@/auth/useSession', () => ({ useFarmAccess: jest.fn(() => ({ can: () => true, isAdmin: true, farmRole: 'OWNER', session: null })) }));
jest.mock('@/store/api/farmsApi', () => ({ useListFarmsQuery: jest.fn(() => ({ data: [{ id: 7, name: 'Ferme Test' }] })) }));
// Added with the banner and the comparison card: mocks are per API module, so a component
// gaining a hook fails every test that renders it until its module is stubbed here.
jest.mock('@/store/api/announcementsApi', () => ({ useGetActiveAnnouncementsQuery: jest.fn(() => ({ data: [] })) }));
jest.mock('@/store/api/benchmarksApi', () => ({ useGetBenchmarkComparisonQuery: jest.fn(() => ({ data: undefined })) }));
jest.mock('@/store/api/partnersApi', () => ({ useGetMyPartnersQuery: jest.fn(() => ({ data: [] })) }));
jest.mock('@/store/api/activityApi', () => ({ useGetFarmActivityQuery: jest.fn(() => ({ data: [{ kind: 'SALE', at: '2026-08-13T09:00:00', label: 'Vente enregistrée', detail: null }] })) }));
jest.mock('@/store/api/dashboardApi', () => ({
  useGetDashboardQuery: jest.fn(() => ({
    data: {
      period: { kind: 'preset', value: '30d', from: '', to: '' },
      commercial: {
        revenueXof: 480000,
        revenueSeries: [{ date: '2026-08-01', valueXof: 100000 }, { date: '2026-08-02', valueXof: 180000 }, { date: '2026-08-03', valueXof: 200000 }],
        outstandingXof: 0,
        overdueXof: 25000,
        topClients: [],
        topDebtors: [],
        ordersToDeliver: 2,
        invoicesToCollect: 1,
      },
      livestock: {
        activeBatches: 3,
        totalHeadcount: 1200,
        deaths: 4,
        mortalityRate: 0.3,
        mortalitySeries: [{ date: '2026-08-01', valueXof: 1 }, { date: '2026-08-02', valueXof: 2 }, { date: '2026-08-03', valueXof: 1 }],
        layingSeries: [],
        vaccinationsCount: 0,
        treatmentsCount: 0,
      },
    },
    isLoading: false,
  })),
}));

import HomeScreen from '../home';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { useGetDashboardQuery } from '@/store/api/dashboardApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';

const dashboardMock = useGetDashboardQuery as unknown as jest.Mock;
const defaultDashboard = dashboardMock.getMockImplementation();
const selectorMock = useSelector as unknown as jest.Mock;
const defaultSelector = selectorMock.getMockImplementation();
afterEach(() => {
  dashboardMock.mockImplementation(defaultDashboard);
  selectorMock.mockImplementation(defaultSelector);
});

describe('Home', () => {
  it('renders the hero headline, stat tiles, an alerts strip and recent activity', async () => {
    await render(<HomeScreen />);
    // Hero uses the commercial revenue as the headline metric.
    expect(screen.getByText('Ventes de la période')).toBeTruthy();
    // Stat tiles.
    expect(screen.getByText('Effectif vivant')).toBeTruthy();
    // "Mortalité" appears as both a stat tile and an alert pill.
    expect(screen.getAllByText('Mortalité').length).toBeGreaterThanOrEqual(1);
    // Alerts strip (ordersToDeliver + invoicesToCollect + deaths).
    expect(screen.getByLabelText('À livrer : 2')).toBeTruthy();
    expect(screen.getByLabelText('À encaisser : 1')).toBeTruthy();
    // Activity feed.
    expect(screen.getByText('Vente enregistrée')).toBeTruthy();
  });

  it('tints a bad-already fact red and something-needing-action orange', async () => {
    await render(<HomeScreen />);

    // Mortality: deaths already happened — error red.
    expect(screen.getByText('4').props.style).toContainEqual(
      expect.objectContaining({ color: '#DC2626' }),
    );
    // Overdue payments: money to collect, not itself a failure — accent orange, not error red.
    expect(screen.getByText('25 000 F').props.style).toContainEqual(
      expect.objectContaining({ color: '#F8961E' }),
    );
    expect(screen.getByText('25 000 F').props.style).not.toContainEqual(
      expect.objectContaining({ color: '#DC2626' }),
    );
  });

  describe('when the dashboard has no data', () => {
    it('shows a spinner while the first load is in flight', async () => {
      dashboardMock.mockReturnValue({ data: undefined, isLoading: true, isFetching: true, isError: false, refetch: jest.fn() });
      await render(<HomeScreen />);
      expect(screen.getByLabelText('Chargement du tableau de bord')).toBeTruthy();
      expect(screen.queryByText('Réessayer')).toBeNull();
    });

    it('shows an error with a retry — never an endless spinner — when the request failed', async () => {
      const refetch = jest.fn();
      dashboardMock.mockReturnValue({ data: undefined, isLoading: false, isFetching: false, isError: true, refetch });
      await render(<HomeScreen />);
      expect(screen.queryByLabelText('Chargement du tableau de bord')).toBeNull();
      expect(screen.getByText('Impossible de charger le tableau de bord')).toBeTruthy();
      fireEvent.press(screen.getByText('Réessayer'));
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('shows the retry as well when the query never ran (skipped: no data, not loading, no error)', async () => {
      dashboardMock.mockReturnValue({ data: undefined, isLoading: false, isFetching: false, isError: false, refetch: jest.fn() });
      await render(<HomeScreen />);
      expect(screen.queryByLabelText('Chargement du tableau de bord')).toBeNull();
      expect(screen.getByText('Réessayer')).toBeTruthy();
    });

    it('with no farm selected, the retry goes back to the farm picker instead of refetching a skipped query', async () => {
      const replace = jest.fn();
      (useRouter as jest.Mock).mockReturnValue({ push: jest.fn(), replace });
      selectorMock.mockImplementation((sel: unknown) => (sel === selectSelectedFarmId ? null : 7));
      const refetch = jest.fn();
      dashboardMock.mockReturnValue({ data: undefined, isLoading: false, isFetching: false, isError: false, refetch });
      await render(<HomeScreen />);
      fireEvent.press(screen.getByText('Réessayer'));
      expect(refetch).not.toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith('/(field)');
    });

    it('keeps showing the cached figures when a refresh failed (offline)', async () => {
      const cached = (defaultDashboard as () => { data: unknown })().data;
      dashboardMock.mockReturnValue({ data: cached, isLoading: false, isFetching: false, isError: true, refetch: jest.fn() });
      await render(<HomeScreen />);
      expect(screen.getByText('Ventes de la période')).toBeTruthy();
      expect(screen.queryByText('Impossible de charger le tableau de bord')).toBeNull();
    });
  });
});
