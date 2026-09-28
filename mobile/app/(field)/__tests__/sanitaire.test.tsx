/**
 * The farm-level health overview (Suivi sanitaire): its four KPI tiles should tint only when
 * there is something to flag — an already-bad fact (vaccines late) — never permanently, and
 * never for the merely informational ones (active treatments, withdrawal delay, next vet visit).
 */
import { render, screen } from '@testing-library/react-native';
import type { HealthAlerts } from '@/types';

jest.mock('expo-router', () => ({ Redirect: () => null }));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/store/api/productionUnitsApi', () => ({
  useListProductionUnitsQuery: jest.fn(() => ({ data: [] })),
}));

let mockAlerts: HealthAlerts = {
  vaccinationsLate: [],
  activeWithdrawals: [],
  upcomingFollowUps: [],
  criticalObservations: [],
};

jest.mock('@/store/api/healthApi', () => ({
  useGetHealthAlertsQuery: jest.fn(() => ({ data: mockAlerts, isLoading: false, error: undefined })),
  useGetVaccinesQuery: jest.fn(() => ({ data: [] })),
  useGetProgramsQuery: jest.fn(() => ({ data: [] })),
  useGetTreatmentCatalogQuery: jest.fn(() => ({ data: [] })),
}));

// eslint-disable-next-line import/first
import SanitaireScreen from '../sanitaire';

beforeEach(() => {
  mockAlerts = {
    vaccinationsLate: [],
    activeWithdrawals: [],
    upcomingFollowUps: [],
    criticalObservations: [],
  };
});

describe('Suivi sanitaire (farm overview)', () => {
  it('leaves the tiles untinted when there is nothing to flag — no permanent colour', async () => {
    await render(<SanitaireScreen />);

    // "0 vaccins en retard" is good news; it must not still read as a signal (the old code
    // tinted it success-green even when healthy — a permanent tint is not a signal anymore).
    for (const el of screen.getAllByText('0')) {
      expect(el.props.style).not.toContainEqual(expect.objectContaining({ color: '#16A34A' }));
    }
  });

  it('tints only the late-vaccines tile red once there is one, an already-bad fact', async () => {
    mockAlerts = {
      ...mockAlerts,
      vaccinationsLate: [
        { unitId: 1, unitName: 'Bande A', vaccineKey: 'newcastle_la_sota', dueDate: '2026-09-01', daysLate: 3 },
      ],
    };
    await render(<SanitaireScreen />);

    expect(screen.getByText('1').props.style).toContainEqual(
      expect.objectContaining({ color: '#DC2626' }),
    );
    // The other three tiles stay neutral — no info/warning/vet colour just to fill the column.
    expect(screen.getByText('0').props.style).not.toContainEqual(
      expect.objectContaining({ color: expect.stringMatching(/^#(2563EB|D97706|7C3AED)$/) }),
    );
  });
});
