/**
 * ProgramSheet: create, clone, edit and validate a vaccination program's calendar.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ProgramSheet } from '../ProgramSheet';
import type { Breed } from '@/store/api/breedsApi';
import type { Vaccine, VaccinationProgram } from '@/types';

const press = async (el: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(el);
  });
};
const type = async (el: Parameters<typeof fireEvent.changeText>[0], text: string) => {
  await act(async () => {
    fireEvent.changeText(el, text);
  });
};

const breeds: Breed[] = [
  { id: 1, species: 'POULTRY', code: 'cobb500', name: 'Cobb 500', type: 'broiler', farmId: null, active: true },
  { id: 2, species: 'POULTRY', code: 'isa_brown', name: 'ISA Brown', type: 'layer', farmId: null, active: true },
];

const vaccines: Vaccine[] = [
  {
    key: 'newcastle_la_sota',
    label: 'Newcastle La Sota',
    disease: 'Newcastle',
    route: 'ocular',
    activeStrain: true,
    usage: '',
    wave: 'V1',
    custom: false,
  },
  {
    key: 'gumboro',
    label: 'Gumboro',
    disease: 'Gumboro',
    route: 'drinking_water',
    activeStrain: true,
    usage: '',
    wave: 'V1',
    custom: false,
  },
];

const platformProgram: VaccinationProgram = {
  key: 'standard_chair',
  label: 'Standard chair',
  species: 'POULTRY',
  breedKeys: ['cobb500'],
  schedule: [
    { ageValue: 7, ageUnit: 'DAY', vaccineKey: 'newcastle_la_sota', route: 'ocular', mandatory: true },
  ],
  custom: false,
};

const customProgram: VaccinationProgram = {
  ...platformProgram,
  key: 'mon_programme',
  label: 'Mon programme',
  custom: true,
};

function baseProps() {
  return {
    open: true,
    entry: null,
    cloneFrom: null,
    vaccines,
    breeds,
    existingKeys: [platformProgram.key, customProgram.key],
    saving: false,
    onClose: jest.fn(),
    onSubmit: jest.fn(),
  };
}

describe('ProgramSheet', () => {
  it('starts blank with one empty step when creating', async () => {
    await render(<ProgramSheet {...baseProps()} />);

    expect(screen.getByText('Nouveau programme')).toBeTruthy();
    expect(screen.getByLabelText('Nom du programme').props.value).toBe('');
    // Only one "Retirer l'étape" would exist if there were 2+ steps; with 1, removal is disabled.
    expect(screen.getByLabelText("Retirer l'étape").props.accessibilityState?.disabled).toBe(true);
  });

  it('prefills from a platform program when cloning, title says so', async () => {
    await render(<ProgramSheet {...baseProps()} cloneFrom={platformProgram} />);

    expect(screen.getByText('Cloner le programme')).toBeTruthy();
    expect(screen.getByLabelText('Nom du programme').props.value).toBe('Standard chair');
    expect(screen.getByText('Cobb 500')).toBeTruthy();
  });

  it('prefills from the entry when editing, title says so, key stays fixed', async () => {
    const onSubmit = jest.fn();
    await render(<ProgramSheet {...baseProps()} entry={customProgram} onSubmit={onSubmit} />);

    expect(screen.getByText('Modifier le programme')).toBeTruthy();
    expect(screen.getByLabelText('Nom du programme').props.value).toBe('Mon programme');

    await press(screen.getByLabelText('Enregistrer'));

    expect(onSubmit).toHaveBeenCalledWith('mon_programme', expect.anything());
  });

  it('adds and removes schedule steps, keeping at least one', async () => {
    await render(<ProgramSheet {...baseProps()} />);

    await press(screen.getByLabelText('Ajouter une étape'));

    const removeButtons = screen.getAllByLabelText("Retirer l'étape");
    expect(removeButtons).toHaveLength(2);
    expect(removeButtons[0]?.props.accessibilityState?.disabled).toBe(false);

    await press(removeButtons[1]!);

    expect(screen.getAllByLabelText("Retirer l'étape")).toHaveLength(1);
  });

  it('toggles a breed on and off', async () => {
    await render(<ProgramSheet {...baseProps()} />);

    await press(screen.getByLabelText('Cobb 500'));
    expect(screen.getByLabelText('Cobb 500').props.accessibilityState?.selected).toBe(true);

    await press(screen.getByLabelText('Cobb 500'));
    expect(screen.getByLabelText('Cobb 500').props.accessibilityState?.selected).toBe(false);
  });

  it('refuses to submit without a name, a breed, and a complete step', async () => {
    const onSubmit = jest.fn();
    await render(<ProgramSheet {...baseProps()} onSubmit={onSubmit} />);

    await press(screen.getByLabelText('Enregistrer'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a full payload in the shape the backend expects', async () => {
    const onSubmit = jest.fn();
    await render(<ProgramSheet {...baseProps()} onSubmit={onSubmit} />);

    await type(screen.getByLabelText('Nom du programme'), 'Standard ponte');
    await press(screen.getByLabelText('Cobb 500'));
    await press(screen.getByLabelText('Vaccin'));
    await press(screen.getByLabelText('Newcastle La Sota'));
    await type(screen.getByLabelText('Âge'), '7');
    await press(screen.getByLabelText('Obligatoire'));

    await press(screen.getByLabelText('Enregistrer'));

    expect(onSubmit).toHaveBeenCalledWith('standard_ponte', {
      label: 'Standard ponte',
      species: 'POULTRY',
      breed_keys: ['cobb500'],
      schedule: [
        {
          age: { value: 7, unit: 'DAY' },
          vaccine_key: 'newcastle_la_sota',
          mandatory: true,
        },
      ],
    });
  });

  it('rejects a new program name that collides with an existing key', async () => {
    await render(<ProgramSheet {...baseProps()} />);

    await type(screen.getByLabelText('Nom du programme'), 'Mon programme');

    expect(screen.getByText('Un programme porte déjà ce nom')).toBeTruthy();
  });
});
