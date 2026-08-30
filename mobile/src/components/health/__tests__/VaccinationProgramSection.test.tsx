import { act, fireEvent, render } from '@testing-library/react-native';
import { VaccinationProgramSection } from '../VaccinationProgramSection';
import type { VaccinationProgram, VaccinationScheduleStatus } from '@/types';

const press = async (el: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(el);
  });
};

const PROGRAMS: VaccinationProgram[] = [
  {
    key: 'chair_std',
    label: 'Programme Chair Standard',
    species: 'POULTRY',
    breedKeys: ['cobb_500'],
    schedule: [
      { ageValue: 1, ageUnit: 'DAY', vaccineKey: 'marek', route: 'injectable', mandatory: true },
      { ageValue: 7, ageUnit: 'DAY', vaccineKey: 'newcastle_b1', route: 'ocular', mandatory: true },
    ],
  },
];

function step(over: Partial<VaccinationScheduleStatus> = {}): VaccinationScheduleStatus {
  return {
    vaccineKey: 'newcastle_b1',
    ageValue: 7,
    ageUnit: 'DAY',
    dueDate: '2026-08-20',
    status: 'UPCOMING',
    mandatory: true,
    ...over,
  };
}

const ASSIGNMENT = {
  unitId: 12,
  programKey: 'chair_std',
  assignedBy: 1,
  assignedAt: '2026-08-01T00:00:00',
};

async function setup(props: Partial<React.ComponentProps<typeof VaccinationProgramSection>> = {}) {
  const handlers = { onAssign: jest.fn(), onRemove: jest.fn(), onRecordDose: jest.fn() };
  const utils = await render(
    <VaccinationProgramSection
      assignment={props.assignment ?? ASSIGNMENT}
      schedule={props.schedule ?? []}
      programs={props.programs ?? PROGRAMS}
      canManage={props.canManage ?? true}
      loading={props.loading}
      {...handlers}
      {...props}
    />,
  );
  return { ...utils, ...handlers };
}

describe('VaccinationProgramSection', () => {
  it('offers the programmes when the lot follows none', async () => {
    const { getByText, onAssign, getByLabelText } = await setup({ assignment: null });

    expect(getByText(/Aucun programme suivi/)).toBeTruthy();
    await press(getByLabelText('Suivre le programme Programme Chair Standard'));
    expect(onAssign).toHaveBeenCalledWith('chair_std');
  });

  it('says who may assign one rather than offering a button that will 403', async () => {
    const { getByText, queryByLabelText } = await setup({ assignment: null, canManage: false });

    expect(getByText(/Seul le propriétaire ou un gérant/)).toBeTruthy();
    expect(queryByLabelText('Suivre le programme Programme Chair Standard')).toBeNull();
  });

  it('leads with what is late, because that is why the screen is opened', async () => {
    const { getByText } = await setup({
      schedule: [
        step({ vaccineKey: 'marek', status: 'DONE', dueDate: '2026-08-02' }),
        step({ vaccineKey: 'newcastle_b1', status: 'LATE', dueDate: '2026-08-08' }),
      ],
    });

    expect(getByText('1 dose en retard')).toBeTruthy();
  });

  it('says so plainly when nothing is late', async () => {
    const { getByText } = await setup({ schedule: [step({ status: 'UPCOMING' })] });

    expect(getByText('Aucune dose en retard.')).toBeTruthy();
  });

  it('hides the done steps behind a count', async () => {
    const { queryByText, getByLabelText, getByText } = await setup({
      schedule: [
        step({ vaccineKey: 'marek', status: 'DONE' }),
        step({ vaccineKey: 'gumboro', status: 'DONE' }),
      ],
    });

    // Done steps answer "have I finished", not "what do I do today".
    expect(getByText('2 doses déjà faites')).toBeTruthy();
    expect(queryByText('Marek')).toBeNull();

    await press(getByLabelText('Voir les doses faites'));
    expect(getByText('Marek')).toBeTruthy();
  });

  it('shows the vaccine name, never the raw key', async () => {
    const { getByText, queryByText } = await setup({
      schedule: [step({ vaccineKey: 'newcastle_b1', status: 'LATE' })],
    });

    expect(getByText('Newcastle B1')).toBeTruthy();
    expect(queryByText('newcastle_b1')).toBeNull();
  });

  it('opens the entry form from a step, prefilled by the caller', async () => {
    const late = step({ status: 'LATE' });
    const { getByLabelText, onRecordDose } = await setup({ schedule: [late] });

    await press(getByLabelText('Saisir Newcastle B1'));

    expect(onRecordDose).toHaveBeenCalledWith(late);
  });

  it('renders nothing while the assignment is still loading', async () => {
    const { toJSON } = await setup({ assignment: null, loading: true });

    // Otherwise the empty state flashes before the programme arrives.
    expect(toJSON()).toBeNull();
  });
});
