import { render, screen } from '@testing-library/react-native';

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
});
