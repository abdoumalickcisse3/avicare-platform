/**
 * The health library screen: what each role may do, and what the platform catalog forbids.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { Treatment, Vaccine, Veterinarian } from '@/types';

const press = async (el: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(el);
  });
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));

const mockAccess = { can: jest.fn(() => true), isAdmin: false, farmRole: 'OWNER', session: null };
jest.mock('@/auth/useSession', () => ({ useFarmAccess: () => mockAccess }));

// babel-plugin-jest-hoist forbids a mock factory from closing over an out-of-scope variable
// unless its name starts with "mock" — the same rule the mortality test documents.
const mockPlatformVaccine: Vaccine = {
  key: 'newcastle_la_sota',
  label: 'Newcastle La Sota',
  disease: 'Newcastle',
  route: 'ocular',
  activeStrain: true,
  usage: '',
  wave: 'V1',
  custom: false,
};

const mockCustomVaccine: Vaccine = { ...mockPlatformVaccine, key: 'vaccin_local', label: 'Vaccin local', custom: true };

const mockTreatment: Treatment = {
  key: 'amoxicilline_50',
  label: 'Amoxicilline 50%',
  molecule: 'Amoxicilline',
  drugClass: 'ANTIBIOTIC',
  withdrawalDaysMeat: 7,
  withdrawalDaysEggs: 2,
  routes: ['drinking_water'],
  wave: 'V1',
  custom: true,
};

const mockVet: Veterinarian = {
  id: 4,
  farmId: 7,
  fullName: 'Dr Aminata Sow',
  phone: '770000000',
  email: null,
  speciality: 'Aviaire',
  licenseNumber: null,
  location: 'Thiès',
  notes: null,
  active: true,
  createdAt: '2026-01-01T00:00:00',
};

const mockUpsertVaccine = jest.fn(() => ({ unwrap: () => Promise.resolve({}) }));
const mockDeleteVaccine = jest.fn(() => ({ unwrap: () => Promise.resolve({}) }));

jest.mock('@/store/api/healthApi', () => ({
  useGetVaccineCatalogQuery: () => ({ data: [mockPlatformVaccine, mockCustomVaccine] }),
  useGetTreatmentLibraryQuery: () => ({ data: [mockTreatment] }),
  useGetProgramCatalogQuery: () => ({ data: [] }),
  useGetVeterinariansQuery: () => ({ data: [mockVet] }),
  useUpsertVaccineMutation: () => [mockUpsertVaccine, { isLoading: false }],
  useDeleteVaccineMutation: () => [mockDeleteVaccine, { isLoading: false }],
  useUpsertTreatmentCatalogMutation: () => [jest.fn(), { isLoading: false }],
  useDeleteTreatmentCatalogMutation: () => [jest.fn(), { isLoading: false }],
  useCreateVeterinarianMutation: () => [jest.fn(), { isLoading: false }],
  useUpdateVeterinarianMutation: () => [jest.fn(), { isLoading: false }],
  useDeactivateVeterinarianMutation: () => [jest.fn(), { isLoading: false }],
}));

// eslint-disable-next-line import/first
import HealthLibraryScreen from '../sanitaire';

beforeEach(() => {
  mockAccess.isAdmin = false;
  mockAccess.farmRole = 'OWNER';
  jest.clearAllMocks();
});

describe('HealthLibraryScreen', () => {
  it('lets an owner edit a custom entry', async () => {
    await render(<HealthLibraryScreen />);

    expect(screen.getByLabelText('Modifier Vaccin local')).toBeTruthy();
  });

  it('refuses to edit a platform entry, which is shared by every farm', async () => {
    await render(<HealthLibraryScreen />);

    // The catalog is the platform's; a farm can add to it, not rewrite it.
    expect(screen.queryByLabelText('Modifier Newcastle La Sota')).toBeNull();
    expect(screen.getByText('Newcastle La Sota')).toBeTruthy();
  });

  it('marks which entries belong to the farm', async () => {
    await render(<HealthLibraryScreen />);

    expect(screen.getAllByText('Perso').length).toBe(1);
  });

  it('gives a worker a read-only library', async () => {
    mockAccess.farmRole = 'FARMER';

    await render(<HealthLibraryScreen />);

    // The backend gates catalog writes on the role; offering the buttons would only 403.
    expect(screen.queryByLabelText('Modifier Vaccin local')).toBeNull();
    expect(screen.queryByLabelText('Nouveau vaccin')).toBeNull();
  });

  it('offers to add in every editable section', async () => {
    await render(<HealthLibraryScreen />);

    expect(screen.getByLabelText('Nouveau vaccin')).toBeTruthy();

    await press(screen.getByLabelText('Vétérinaires'));
    expect(screen.getByLabelText('Nouveau vétérinaire')).toBeTruthy();
  });

  it('offers no add button on the programmes, which cannot be authored', async () => {
    await render(<HealthLibraryScreen />);

    await press(screen.getByLabelText('Programmes'));

    // Custom programmes are out of scope platform-wide; a button here would be a lie.
    expect(screen.queryByLabelText(/Nouveau/)).toBeNull();
    expect(screen.getByText(/en lecture seule/)).toBeTruthy();
  });

  it('shows the withdrawal delays on a treatment, since that is what it decides', async () => {
    await render(<HealthLibraryScreen />);

    await press(screen.getByLabelText('Traitements'));

    expect(screen.getByText(/2 j œufs \/ 7 j viande/)).toBeTruthy();
  });

  it('lists a veterinarian with the number that will be dialled', async () => {
    await render(<HealthLibraryScreen />);

    await press(screen.getByLabelText('Vétérinaires'));

    expect(screen.getByText(/770000000/)).toBeTruthy();
  });
});
