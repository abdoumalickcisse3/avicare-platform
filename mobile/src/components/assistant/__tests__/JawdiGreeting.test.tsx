import { act, render, screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

jest.mock('@/assistant/speech/tts', () => ({
  speak: jest.fn(() => Promise.resolve()),
  stopSpeaking: jest.fn(() => Promise.resolve()),
}));

import { JawdiGreeting } from '@/components/assistant/JawdiGreeting';

const SUGGESTIONS = ['Combien de sacs d’aliment ?', 'Ma marge ce mois-ci ?'];
const TYPING = 'Jawdi IA écrit…';
const INTRODUCTION = 'Je suis Jawdi IA, votre conseiller d’élevage.';

/** The whole sequence, with room to spare — the component owns the exact timings. */
const playWholeSequence = () => act(() => void jest.advanceTimersByTime(4000));

let reduceMotion: jest.SpyInstance;

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

describe('JawdiGreeting', () => {
  it('se présente comme quelqu’un qui tape, puis parle', async () => {
    await render(<JawdiGreeting suggestions={SUGGESTIONS} onPick={jest.fn()} />);

    // D'abord l'illusion d'une personne : ça tape, rien n'est encore dit.
    expect(screen.getByText(TYPING)).toBeTruthy();
    expect(screen.queryByText(INTRODUCTION)).toBeNull();

    await playWholeSequence();

    expect(screen.getByText(INTRODUCTION)).toBeTruthy();
    expect(screen.queryByText(TYPING)).toBeNull();
  });

  it('salue avant de se présenter', async () => {
    await render(<JawdiGreeting suggestions={SUGGESTIONS} onPick={jest.fn()} />);

    await act(() => void jest.advanceTimersByTime(600));

    expect(screen.getByText('Bonjour 👋')).toBeTruthy();
    expect(screen.queryByText(INTRODUCTION)).toBeNull();
  });

  it('propose les suggestions en dernier, et les rend touchables', async () => {
    const onPick = jest.fn();
    await render(<JawdiGreeting suggestions={SUGGESTIONS} onPick={onPick} />);

    expect(screen.queryByText(SUGGESTIONS[0]!)).toBeNull();
    await playWholeSequence();

    await userEvent.press(screen.getByText(SUGGESTIONS[0]!));
    expect(onPick).toHaveBeenCalledWith(SUGGESTIONS[0]);
  });

  it('laisse écouter le salut, sans le dire tout seul', async () => {
    const { speak } = jest.requireMock('@/assistant/speech/tts') as { speak: jest.Mock };
    await render(<JawdiGreeting suggestions={SUGGESTIONS} onPick={jest.fn()} />);
    await playWholeSequence();

    expect(speak).not.toHaveBeenCalled();
    await userEvent.press(screen.getByLabelText('Écouter à voix haute'));
    expect(speak).toHaveBeenCalledWith(expect.stringContaining('Jawdi IA'), expect.anything());
  });

  it('affiche tout d’un coup quand les animations sont réduites', async () => {
    reduceMotion.mockResolvedValue(true);

    await render(<JawdiGreeting suggestions={SUGGESTIONS} onPick={jest.fn()} />);

    // Aucun temps avancé : la scène est déjà jouée.
    expect(screen.getByText(INTRODUCTION)).toBeTruthy();
    expect(screen.getByText(SUGGESTIONS[0]!)).toBeTruthy();
    expect(screen.queryByText(TYPING)).toBeNull();
  });
});
