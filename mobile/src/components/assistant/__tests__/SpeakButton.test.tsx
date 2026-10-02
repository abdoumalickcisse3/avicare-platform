import { act, render, screen, userEvent } from '@testing-library/react-native';

/**
 * `jest.fn()` with an untyped implementation is inferred as taking no arguments, so passing it
 * two makes the CI type check fail while jest stays green. The parameters are therefore declared,
 * and the last call is kept here rather than read back through `mock.calls[0][1]` — a tuple index
 * tsc refuses on an empty tuple type.
 */
let lastSpoken: { text: string; onEnd?: () => void } | null = null;
const mockSpeak = jest.fn((text: string, opts?: { onEnd?: () => void }) => {
  lastSpoken = { text, onEnd: opts?.onEnd };
  return Promise.resolve();
});
const mockStopSpeaking = jest.fn(() => Promise.resolve());

jest.mock('@/assistant/speech/tts', () => ({
  speak: (text: string, opts?: { onEnd?: () => void }) => mockSpeak(text, opts),
  stopSpeaking: () => mockStopSpeaking(),
}));

import { SpeakButton } from '@/components/assistant/SpeakButton';

const ANSWER = 'Il vous reste 40 sacs d’aliment.';
const listen = () => screen.getByLabelText('Écouter à voix haute');
const silence = () => screen.getByLabelText('Arrêter la lecture');

beforeEach(() => {
  lastSpoken = null;
  mockSpeak.mockClear();
  mockStopSpeaking.mockClear();
});

describe('SpeakButton', () => {
  it('lit le texte au premier appui', async () => {
    await render(<SpeakButton text={ANSWER} />);

    await userEvent.press(listen());

    expect(mockSpeak).toHaveBeenCalledWith(ANSWER, expect.anything());
  });

  it('arrête la lecture au deuxième appui', async () => {
    await render(<SpeakButton text={ANSWER} />);

    await userEvent.press(listen());
    await userEvent.press(silence());

    expect(mockStopSpeaking).toHaveBeenCalled();
  });

  it('redevient « écouter » quand la lecture se termine seule', async () => {
    await render(<SpeakButton text={ANSWER} />);
    await userEvent.press(listen());

    await act(async () => lastSpoken?.onEnd?.());

    expect(listen()).toBeTruthy();
  });

  it('ne s’affiche pas sans texte à lire', async () => {
    await render(<SpeakButton text="   " />);

    expect(screen.queryByLabelText('Écouter à voix haute')).toBeNull();
  });
});
