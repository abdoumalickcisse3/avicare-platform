import { fireEvent, render, screen } from '@testing-library/react-native';
import { SyncStatusBar } from '../SyncStatusBar';

describe('SyncStatusBar', () => {
  // @testing-library/react-native@14 made `render()` async (it now renders
  // through the `test-renderer` package's `createRoot`, not the old
  // synchronous `react-test-renderer`), so every case here awaits it before
  // reading `screen` — the assertions and French strings themselves are
  // exactly the brief's.
  it('shows the pending count when offline', async () => {
    await render(<SyncStatusBar online={false} pending={5} failed={0} syncing={false} />);
    expect(screen.getByText('5 actions en attente de sync')).toBeTruthy();
  });

  it('singularises one pending action', async () => {
    await render(<SyncStatusBar online={false} pending={1} failed={0} syncing={false} />);
    expect(screen.getByText('1 action en attente de sync')).toBeTruthy();
  });

  it('confirms everything is synced when online and empty', async () => {
    await render(<SyncStatusBar online pending={0} failed={0} syncing={false} />);
    expect(screen.getByText('Tout est synchronisé')).toBeTruthy();
  });

  it('surfaces failures over the pending count', async () => {
    await render(<SyncStatusBar online pending={2} failed={1} syncing={false} />);
    expect(screen.getByText('1 saisie à corriger')).toBeTruthy();
  });

  it('opens the queue screen when tapped, if an onPress is provided', async () => {
    const onPress = jest.fn();
    await render(<SyncStatusBar online pending={2} failed={1} syncing={false} onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('1 saisie à corriger'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
