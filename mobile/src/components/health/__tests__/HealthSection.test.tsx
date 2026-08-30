/**
 * The Sanitaire tab's composition: the lot status rule, the vaccination ratio, and which
 * actions each role is offered.
 *
 * Nothing rendered this component before, which is how its status rule drifted from the web's:
 * mobile flagged VIGILANCE on a recent critical observation only, so a lot with three overdue
 * doses still read SAIN.
 */
import { render } from '@testing-library/react-native';
import { HealthSection } from '../HealthSection';
import type { VaccinationScheduleStatus } from '@/types';

const mockAccess = { can: jest.fn(() => true), isAdmin: false, farmRole: 'OWNER', session: null };
jest.mock('@/auth/useSession', () => ({ useFarmAccess: () => mockAccess }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const state = {
  vaccinations: [] as unknown[],
  observations: [] as unknown[],
  schedule: [] as VaccinationScheduleStatus[],
};

// Mocks are per API module: a component gaining a hook fails every test that renders it until
// its module is stubbed here.
jest.mock('@/store/api/healthApi', () => ({
  useGetVaccinationsQuery: () => ({ data: state.vaccinations }),
  useGetObservationsQuery: () => ({ data: state.observations }),
  useGetProgramAssignmentQuery: () => ({ data: null, isLoading: false }),
  useGetScheduleQuery: () => ({ data: state.schedule }),
  useGetProgramCatalogQuery: () => ({ data: [] }),
  useGetTreatmentsQuery: () => ({ data: [] }),
  useGetVetVisitsQuery: () => ({ data: [] }),
  useGetVeterinariansQuery: () => ({ data: [] }),
  useAssignProgramMutation: () => [jest.fn()],
  useRemoveProgramMutation: () => [jest.fn()],
}));

function step(over: Partial<VaccinationScheduleStatus> = {}): VaccinationScheduleStatus {
  return {
    vaccineKey: 'newcastle_b1',
    ageValue: 7,
    ageUnit: 'DAY',
    dueDate: '2026-08-01',
    status: 'UPCOMING',
    mandatory: true,
    ...over,
  };
}

beforeEach(() => {
  state.vaccinations = [];
  state.observations = [];
  state.schedule = [];
  mockAccess.can = jest.fn(() => true);
  mockAccess.isAdmin = false;
  mockAccess.farmRole = 'OWNER';
});

describe('HealthSection', () => {
  it('flags VIGILANCE on an overdue dose, not only on an observation', async () => {
    state.schedule = [step({ status: 'LATE' })];

    const { getByText } = await render(<HealthSection farmId={7} unitId={12} />);

    // The rule mobile was missing: three overdue vaccines used to read SAIN.
    expect(getByText('VIGILANCE')).toBeTruthy();
  });

  it('reads SAIN when nothing is late and nothing was observed', async () => {
    state.schedule = [step({ status: 'DONE' })];

    const { getByText } = await render(<HealthSection farmId={7} unitId={12} />);

    expect(getByText('SAIN')).toBeTruthy();
  });

  it('shows the vaccination ratio once a programme is followed', async () => {
    state.schedule = [
      step({ vaccineKey: 'marek', status: 'DONE' }),
      step({ vaccineKey: 'gumboro', status: 'DONE' }),
      step({ vaccineKey: 'newcastle_b1', status: 'UPCOMING' }),
    ];

    const { getByText } = await render(<HealthSection farmId={7} unitId={12} />);

    // "2 doses done" means nothing without knowing the programme asks for three.
    expect(getByText('2/3')).toBeTruthy();
  });

  it('falls back to a plain count with no programme', async () => {
    state.vaccinations = [
      { id: 1, vaccineKey: 'marek', administeredDate: '2026-08-01', subjectsCount: 500, route: null, notes: null, unitId: 12 },
      { id: 2, vaccineKey: 'gumboro', administeredDate: '2026-08-08', subjectsCount: 500, route: null, notes: null, unitId: 12 },
    ];

    const { getByText } = await render(<HealthSection farmId={7} unitId={12} />);

    expect(getByText('2')).toBeTruthy();
  });

  it('offers treatment and vet visit to an owner', async () => {
    const { getByLabelText } = await render(<HealthSection farmId={7} unitId={12} />);

    expect(getByLabelText('Nouveau traitement')).toBeTruthy();
    expect(getByLabelText('Nouvelle visite vétérinaire')).toBeTruthy();
  });

  it('withholds them from a worker the server would refuse', async () => {
    mockAccess.farmRole = 'FARMER';

    const { queryByLabelText, getByLabelText } = await render(
      <HealthSection farmId={7} unitId={12} />,
    );

    // Recording a treatment is OWNER/MANAGER server-side; a button that 403s teaches distrust.
    expect(queryByLabelText('Nouveau traitement')).toBeNull();
    // The two basic entries stay: they need only `health:write`.
    expect(getByLabelText('Nouvelle vaccination')).toBeTruthy();
  });

  it('hides every entry action without health:write', async () => {
    mockAccess.can = jest.fn(() => false);
    mockAccess.farmRole = 'VETERINARIAN';

    const { queryByLabelText } = await render(<HealthSection farmId={7} unitId={12} />);

    expect(queryByLabelText('Nouvelle vaccination')).toBeNull();
  });
});
