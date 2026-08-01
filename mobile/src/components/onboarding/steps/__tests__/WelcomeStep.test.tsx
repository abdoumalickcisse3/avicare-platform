import { render, screen } from '@testing-library/react-native';
import { WelcomeStep } from '../WelcomeStep';

it('shows the four modules', async () => {
  await render(<WelcomeStep />);
  for (const label of ['Élevage', 'Stock', 'Commercial', 'Finance']) {
    expect(screen.getByText(label)).toBeTruthy();
  }
});
