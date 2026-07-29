import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SkyBackground } from '../SkyBackground';

// @testing-library/react-native@14 made `render()` async (see
// SyncStatusBar.test.tsx) — await it, then read through `screen`.
it('renders its children over the sky', async () => {
  await render(
    <SkyBackground stepIndex={0} total={7}>
      <Text>hello</Text>
    </SkyBackground>,
  );
  expect(screen.getByText('hello')).toBeTruthy();
});
