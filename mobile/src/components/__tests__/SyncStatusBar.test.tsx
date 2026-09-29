import { fireEvent, render, screen } from '@testing-library/react-native';
import { SyncStatusBar } from '../SyncStatusBar';

describe('SyncStatusBar', () => {
  // @testing-library/react-native@14 made `render()` async (it now renders
  // through the `test-renderer` package's `createRoot`, not the old
  // synchronous `react-test-renderer`), so every case here awaits it before
  // reading `screen` — the assertions and French strings themselves are
  // exactly the brief's.
  it('shows the pending count while online (being sent)', async () => {
    await render(<SyncStatusBar online pending={5} failed={0} syncing={false} />);
    expect(screen.getByText('5 actions en attente de sync')).toBeTruthy();
  });

  it('singularises one pending action', async () => {
    await render(<SyncStatusBar online pending={1} failed={0} syncing={false} />);
    expect(screen.getByText('1 action en attente de sync')).toBeTruthy();
  });

  it('renders nothing when online and everything is synced — a permanent "all good" ribbon is noise', async () => {
    await render(<SyncStatusBar online pending={0} failed={0} syncing={false} />);
    expect(screen.queryByText('Tout est synchronisé')).toBeNull();
    expect(screen.queryByRole('text')).toBeNull();
    expect(screen.toJSON()).toBeNull();
  });

  it('says so when offline with nothing queued, instead of claiming everything is synced', async () => {
    await render(<SyncStatusBar online={false} pending={0} failed={0} syncing={false} />);
    expect(screen.queryByText('Tout est synchronisé')).toBeNull();
    expect(screen.getByText('Hors ligne — vos saisies sont gardées')).toBeTruthy();
  });

  it('combines offline and the pending count in one phrase', async () => {
    await render(<SyncStatusBar online={false} pending={3} failed={0} syncing={false} />);
    expect(screen.getByText('Hors ligne · 3 actions en attente')).toBeTruthy();
  });

  it('singularises the offline pending phrase', async () => {
    await render(<SyncStatusBar online={false} pending={1} failed={0} syncing={false} />);
    expect(screen.getByText('Hors ligne · 1 action en attente')).toBeTruthy();
  });

  it('still surfaces failures first when offline', async () => {
    await render(<SyncStatusBar online={false} pending={2} failed={2} syncing={false} />);
    expect(screen.getByText('2 saisies à corriger')).toBeTruthy();
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
