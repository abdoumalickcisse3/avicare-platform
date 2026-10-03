import { act, render, screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { JawdiButton } from '@/components/assistant/JawdiButton';

let reduceMotion: jest.SpyInstance;

/** The button resolves reduce-motion asynchronously; let that promise land. */
const settle = async () => {
  await act(async () => {});
};

beforeEach(() => {
  jest.useFakeTimers();
  reduceMotion = jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
});

afterEach(() => {
  jest.useRealTimers();
  reduceMotion.mockRestore();
});

describe('JawdiButton', () => {
  it('se présente comme quelqu’un, pas comme un micro', async () => {
    await render(<JawdiButton onPress={jest.fn()} />);

    expect(screen.getByText('Jawdi IA')).toBeTruthy();
    expect(screen.getByLabelText(/Jawdi IA, votre conseiller/)).toBeTruthy();
  });

  it('mène à l’assistant quand on le presse', async () => {
    const onPress = jest.fn();
    await render(<JawdiButton onPress={onPress} />);

    await userEvent.press(screen.getByLabelText(/Jawdi IA, votre conseiller/));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('cligne des yeux — le visage est vivant même sans être touché', async () => {
    await render(<JawdiButton onPress={jest.fn()} />);
    await settle();

    expect(screen.getByTestId('jawdi-eyes-open')).toBeTruthy();

    await act(() => void jest.advanceTimersByTime(3300));
    expect(screen.getByTestId('jawdi-eyes-closed')).toBeTruthy();

    await act(() => void jest.advanceTimersByTime(200));
    expect(screen.getByTestId('jawdi-eyes-open')).toBeTruthy();
  });

  it('reste immobile quand le téléphone demande moins d’animations', async () => {
    reduceMotion.mockResolvedValue(true);
    await render(<JawdiButton onPress={jest.fn()} />);
    await settle();

    await act(() => void jest.advanceTimersByTime(20000));

    // Le personnage est là, il ne clignote simplement jamais.
    expect(screen.getByTestId('jawdi-eyes-open')).toBeTruthy();
    expect(screen.queryByTestId('jawdi-eyes-closed')).toBeNull();
  });
});
