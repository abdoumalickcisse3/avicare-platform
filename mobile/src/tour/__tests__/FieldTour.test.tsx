/** The tour component: when it renders, and what dismisses it for good. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FieldTour } from '../FieldTour';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const storage = AsyncStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock };

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

beforeEach(() => {
  jest.clearAllMocks();
  storage.setItem.mockResolvedValue(undefined);
});

describe('FieldTour', () => {
  it('renders nothing for someone who has already seen it', async () => {
    storage.getItem.mockResolvedValue('1');

    await render(<FieldTour farmRole="OWNER" />);

    expect(screen.queryByLabelText('Suivant')).toBeNull();
  });

  it('opens on a first run and walks three steps', async () => {
    storage.getItem.mockResolvedValue(null);

    await render(<FieldTour farmRole="OWNER" />);

    expect(screen.getByText('Votre ferme, en un écran')).toBeTruthy();
    await press(screen.getByLabelText('Suivant'));
    expect(screen.getByText('Saisir depuis le poulailler')).toBeTruthy();
    await press(screen.getByLabelText('Suivant'));
    // The last step commits rather than continuing.
    expect(screen.getByLabelText('Commencer')).toBeTruthy();
  });

  it('is skippable from the first card', async () => {
    storage.getItem.mockResolvedValue(null);

    await render(<FieldTour farmRole="FARMER" />);
    await press(screen.getByLabelText('Passer la présentation'));

    expect(screen.queryByLabelText('Suivant')).toBeNull();
    expect(storage.setItem).toHaveBeenCalledWith('tour.seen.FARMER', '1');
  });

  it('shows a field worker their own tour, not the owner one', async () => {
    storage.getItem.mockResolvedValue(null);

    await render(<FieldTour farmRole="FARMER" />);

    expect(screen.getByText('Trois gestes par jour')).toBeTruthy();
  });

  it('marks itself seen only when it is finished or skipped', async () => {
    storage.getItem.mockResolvedValue(null);

    await render(<FieldTour farmRole="OWNER" />);
    await press(screen.getByLabelText('Suivant'));

    // Advancing is not dismissing: a tour half-read must come back.
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
