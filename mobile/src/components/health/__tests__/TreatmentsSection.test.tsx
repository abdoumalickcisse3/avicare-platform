import { act, fireEvent, render } from '@testing-library/react-native';
import { TreatmentsSection } from '../TreatmentsSection';
import { addDays, isoToday } from '@/lib/health';
import type { ExecutedTreatment } from '@/types';

const press = async (el: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(el);
  });
};

function treatment(over: Partial<ExecutedTreatment> = {}): ExecutedTreatment {
  return {
    id: 1,
    unitId: 12,
    treatmentKey: 'amoxicilline_50',
    startDate: '2026-08-01',
    durationDays: 3,
    endDate: '2026-08-03',
    doseAmount: 1,
    doseUnit: 'g/1000L',
    route: 'drinking_water',
    subjectsCount: 500,
    reason: null,
    prescribedBy: 'FARMER',
    veterinarianId: null,
    withdrawalDaysMeat: 7,
    withdrawalDaysEggs: null,
    withdrawalEndDateMeat: '2026-08-10',
    withdrawalEndDateEggs: null,
    notes: null,
    createdBy: 1,
    createdAt: '2026-08-01T00:00:00',
    ...over,
  };
}

async function setup(props: Partial<React.ComponentProps<typeof TreatmentsSection>> = {}) {
  const onDelete = jest.fn();
  const utils = await render(
    <TreatmentsSection
      treatments={props.treatments ?? [treatment()]}
      canDelete={props.canDelete ?? false}
      onDelete={onDelete}
    />,
  );
  return { ...utils, onDelete };
}

describe('TreatmentsSection', () => {
  it('names the treatment, never its key', async () => {
    const { getByText, queryByText } = await setup();

    expect(getByText('Amoxicilline 50')).toBeTruthy();
    expect(queryByText('amoxicilline_50')).toBeNull();
  });

  it('reads the route in French', async () => {
    const { getByText } = await setup();

    expect(getByText(/Eau de boisson/)).toBeTruthy();
  });

  it('leads with the running delay, because it decides when to sell', async () => {
    const endsInFive = addDays(isoToday(), 5);
    const { getByText } = await setup({
      treatments: [treatment({ withdrawalEndDateMeat: endsInFive })],
    });

    expect(getByText('Délai en cours · 5 jours restants')).toBeTruthy();
    expect(getByText(/Vendable dès le/)).toBeTruthy();
  });

  it('says nothing about a delay that has passed', async () => {
    const { queryByText } = await setup({
      treatments: [treatment({ withdrawalEndDateMeat: '2026-01-10' })],
    });

    // A finished delay is not information; repeating it would train the farmer to skip the line.
    expect(queryByText(/Délai en cours/)).toBeNull();
  });

  it('hides the delete button from anyone but the owner', async () => {
    const { queryByLabelText } = await setup({ canDelete: false });

    // The server refuses it; offering a button that 403s teaches people to distrust the app.
    expect(queryByLabelText(/Supprimer le traitement/)).toBeNull();
  });

  it('offers the delete to an owner', async () => {
    const { getByLabelText, onDelete } = await setup({ canDelete: true });

    await press(getByLabelText('Supprimer le traitement Amoxicilline 50'));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('says so plainly when the lot has had no treatment', async () => {
    const { getByText } = await setup({ treatments: [] });

    expect(getByText('Aucun traitement enregistré sur ce lot.')).toBeTruthy();
  });
});
