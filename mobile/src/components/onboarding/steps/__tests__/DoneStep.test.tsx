import { render, screen } from '@testing-library/react-native';
import { DoneStep } from '../DoneStep';

it('shows the ready recap', async () => {
  await render(<DoneStep />);
  expect(screen.getByText('Votre ferme est prête')).toBeTruthy();
});
