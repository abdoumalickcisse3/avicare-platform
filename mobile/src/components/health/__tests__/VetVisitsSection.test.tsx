import { act, fireEvent, render } from '@testing-library/react-native';
import { VetVisitsSection } from '../VetVisitsSection';
import { addDays, isoToday } from '@/lib/health';
import type { Veterinarian, VetVisit } from '@/types';

const press = async (el: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(el);
  });
};

function visit(over: Partial<VetVisit> = {}): VetVisit {
  return {
    id: 1,
    unitId: 12,
    veterinarianId: 4,
    visitDate: '2026-08-20',
    reason: 'Baisse de ponte',
    diagnosis: null,
    recommendations: null,
    costXof: 25000,
    followUpNeeded: false,
    followUpDate: null,
    notes: null,
    createdBy: 1,
    createdAt: '2026-08-20T00:00:00',
    ...over,
  };
}

const VETS: Veterinarian[] = [
  {
    id: 4,
    farmId: 7,
    fullName: 'Dr Aminata Sow',
    phone: null,
    email: null,
    speciality: null,
    licenseNumber: null,
    location: null,
    notes: null,
    active: true,
    createdAt: '2026-01-01T00:00:00',
  },
];

async function setup(props: Partial<React.ComponentProps<typeof VetVisitsSection>> = {}) {
  const onDelete = jest.fn();
  const utils = await render(
    <VetVisitsSection
      visits={props.visits ?? [visit()]}
      veterinarians={props.veterinarians ?? VETS}
      canDelete={props.canDelete ?? false}
      onDelete={onDelete}
    />,
  );
  return { ...utils, onDelete };
}

describe('VetVisitsSection', () => {
  it('names the veterinarian and the cost', async () => {
    const { getByText } = await setup();

    expect(getByText(/Dr Aminata Sow/)).toBeTruthy();
    expect(getByText(/25 000 F/)).toBeTruthy();
  });

  it('says a visit had no named vet rather than leaving a blank', async () => {
    const { getByText } = await setup({ visits: [visit({ veterinarianId: null })] });

    expect(getByText(/Visite sans vétérinaire nommé/)).toBeTruthy();
  });

  it('still names a visit whose vet was since removed from the directory', async () => {
    const { getByText } = await setup({ visits: [visit({ veterinarianId: 99 })] });

    // Deactivating a vet is soft precisely so past visits keep something to show.
    expect(getByText(/Vétérinaire retiré/)).toBeTruthy();
  });

  it('pulls out a scheduled follow-up', async () => {
    const soon = addDays(isoToday(), 6);
    const { getByText } = await setup({
      visits: [visit({ followUpNeeded: true, followUpDate: soon })],
    });

    expect(getByText(/Suivi prévu le/)).toBeTruthy();
  });

  it('says a follow-up is overdue rather than showing it as upcoming', async () => {
    const past = addDays(isoToday(), -3);
    const { getByText } = await setup({
      visits: [visit({ followUpNeeded: true, followUpDate: past })],
    });

    expect(getByText(/Suivi dépassé depuis le/)).toBeTruthy();
  });

  it('shows no follow-up line when none was scheduled', async () => {
    const { queryByText } = await setup();

    expect(queryByText(/Suivi/)).toBeNull();
  });

  it('offers the delete only to those the server will accept', async () => {
    const hidden = await setup({ canDelete: false });
    expect(hidden.queryByLabelText(/Supprimer la visite/)).toBeNull();

    const shown = await setup({ canDelete: true });
    await press(shown.getByLabelText('Supprimer la visite du 20/08/2026'));
    expect(shown.onDelete).toHaveBeenCalledTimes(1);
  });

  it('says so plainly when the lot has had no visit', async () => {
    const { getByText } = await setup({ visits: [] });

    expect(getByText('Aucune visite enregistrée sur ce lot.')).toBeTruthy();
  });
});
