import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasSeenTour, markTourSeen, stepsForRole, tourKey } from '../tour';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const storage = AsyncStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock };

beforeEach(() => jest.clearAllMocks());

describe('stepsForRole', () => {
  it('gives an owner a farm to run', () => {
    expect(stepsForRole('OWNER')[0]?.title).toBe('Votre ferme, en un écran');
  });

  it('gives a manager the same tour as an owner — they run the farm too', () => {
    expect(stepsForRole('MANAGER')).toEqual(stepsForRole('OWNER'));
  });

  it('gives a field worker three gestures, not a farm dashboard', () => {
    expect(stepsForRole('FARMER')[0]?.title).toBe('Trois gestes par jour');
  });

  it('falls back to the field tour for an unknown role rather than showing nothing', () => {
    expect(stepsForRole(undefined)).toEqual(stepsForRole('FARMER'));
  });
});

describe('tourKey', () => {
  it('is scoped per role, so a promotion re-shows the tour that now applies', () => {
    expect(tourKey('FARMER')).not.toBe(tourKey('MANAGER'));
  });
});

describe('hasSeenTour', () => {
  it('is true once the flag has been written', async () => {
    storage.getItem.mockResolvedValue('1');
    await expect(hasSeenTour('OWNER')).resolves.toBe(true);
  });

  it('is false when nothing was stored', async () => {
    storage.getItem.mockResolvedValue(null);
    await expect(hasSeenTour('OWNER')).resolves.toBe(false);
  });

  it('treats unreadable storage as seen, rather than replaying on every launch', async () => {
    storage.getItem.mockRejectedValue(new Error('no storage'));
    await expect(hasSeenTour('OWNER')).resolves.toBe(true);
  });
});

describe('markTourSeen', () => {
  it('writes the per-role flag', async () => {
    storage.setItem.mockResolvedValue(undefined);
    await markTourSeen('FARMER');
    expect(storage.setItem).toHaveBeenCalledWith('tour.seen.FARMER', '1');
  });

  it('swallows a storage failure — the tour reappearing is the harmless direction', async () => {
    storage.setItem.mockRejectedValue(new Error('no storage'));
    await expect(markTourSeen('FARMER')).resolves.toBeUndefined();
  });
});
