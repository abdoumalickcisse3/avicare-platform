import { render, screen } from '@testing-library/react-native';
import { UnitEssentials } from '../UnitEssentials';

describe('UnitEssentials', () => {
  // @testing-library/react-native@14 made `render()` async — see
  // SyncStatusBar.test.tsx for the same note. Assertions and strings below
  // are the brief's, verbatim.
  it('shows the current head count from cache when offline', async () => {
    await render(
      <UnitEssentials unit={{ currentCount: 480, ageDays: 21, breedName: 'Cobb 500' }} stale />,
    );
    expect(screen.getByText('480')).toBeTruthy();
    expect(screen.getByText(/21 jours/)).toBeTruthy();
  });

  it('flags the data as possibly stale when offline', async () => {
    await render(
      <UnitEssentials unit={{ currentCount: 480, ageDays: 21, breedName: 'Cobb 500' }} stale />,
    );
    expect(screen.getByText(/dernière mise à jour/i)).toBeTruthy();
  });
});
