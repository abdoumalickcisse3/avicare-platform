/**
 * The farm sheet, and the one thing it must never do: lose a field it does not show.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { FarmSheet } from '../FarmSheet';
import type { Farm } from '@/store/api/farmsApi';

const farm: Farm = {
  id: 7,
  name: 'Ferme Ndiaye',
  description: 'Ferme pilote de Thiès',
  location: 'Thiès',
  gpsLatitude: 14.7886,
  gpsLongitude: -16.9246,
  capacity: 5000,
  currency: 'XOF',
  timezone: 'Africa/Dakar',
  active: true,
};

const press = async (el: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(el);
  });
};

// React 19 + RNTL 14: a fireEvent outside act() leaves the state update unflushed, and the
// assertion then reads the pre-edit value — which looks like a component bug, not a test one.
const type = async (el: Parameters<typeof fireEvent.changeText>[0], text: string) => {
  await act(async () => {
    fireEvent.changeText(el, text);
  });
};

function setup(over: Partial<React.ComponentProps<typeof FarmSheet>> = {}) {
  const onSubmit = jest.fn();
  const onDelete = jest.fn();
  const props = {
    open: true,
    farm,
    saving: false,
    canDelete: true,
    onClose: jest.fn(),
    onSubmit,
    onDelete,
    ...over,
  };
  return { onSubmit, onDelete, props };
}

describe('FarmSheet', () => {
  it('sends back the GPS coordinates it never showed', async () => {
    // `PUT /farms/{id}` is a replacement: any field left out is written as null. There is no map
    // picker on mobile, so an omitted latitude would be erased by the first rename from a phone.
    const { onSubmit, props } = setup();
    await render(<FarmSheet {...props} />);

    await type(screen.getByDisplayValue('Ferme Ndiaye'), 'Ferme Ndiaye & Fils');
    await press(screen.getByLabelText('Enregistrer la ferme'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ferme Ndiaye & Fils',
        gpsLatitude: 14.7886,
        gpsLongitude: -16.9246,
        description: 'Ferme pilote de Thiès',
      }),
    );
  });

  it('refuses to submit without a name, which the backend requires', async () => {
    const { onSubmit, props } = setup();
    await render(<FarmSheet {...props} />);

    await type(screen.getByDisplayValue('Ferme Ndiaye'), '   ');
    await press(screen.getByLabelText('Enregistrer la ferme'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('hides deletion from anyone who is not the owner', async () => {
    const { props } = setup({ canDelete: false });
    await render(<FarmSheet {...props} />);

    expect(screen.queryByLabelText('Supprimer la ferme')).toBeNull();
  });

  it('keeps the delete button disarmed until the farm name is retyped', async () => {
    // The server applies no guard at all on this route — the confirmation has to live here.
    const { onDelete, props } = setup();
    await render(<FarmSheet {...props} />);

    await press(screen.getByLabelText('Supprimer la ferme'));
    await press(screen.getByLabelText('Confirmer la suppression de la ferme'));
    expect(onDelete).not.toHaveBeenCalled();

    await type(screen.getByPlaceholderText('Ferme Ndiaye'), 'Ferme Ndiaye');
    await press(screen.getByLabelText('Confirmer la suppression de la ferme'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('says what deletion takes with it', async () => {
    const { props } = setup();
    await render(<FarmSheet {...props} />);

    await press(screen.getByLabelText('Supprimer la ferme'));

    expect(screen.getByText(/lots, les saisies, les ventes et la comptabilité/)).toBeTruthy();
  });
});

describe('FarmSheet — creation', () => {
  it('opens empty, names itself for the task, and offers no deletion', async () => {
    const { props } = setup({ farm: undefined, canDelete: false });
    await render(<FarmSheet {...props} />);

    expect(screen.getByText('Nouvelle ferme')).toBeTruthy();
    expect(screen.getByLabelText('Créer la ferme')).toBeTruthy();
    expect(screen.queryByLabelText('Supprimer la ferme')).toBeNull();
  });

  it('sends nulls rather than empty strings for what was left blank', async () => {
    // The column is nullable; an empty string would be a value the farm does not have.
    const { onSubmit, props } = setup({ farm: undefined, canDelete: false });
    await render(<FarmSheet {...props} />);

    await type(screen.getByPlaceholderText('Ferme de Thiès'), 'Ferme Sud');
    await press(screen.getByLabelText('Créer la ferme'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ location: null, capacity: null, gpsLatitude: null }),
    );
  });
});
