const mockSpeak = jest.fn();
const mockStop = jest.fn(async () => {});

jest.mock('expo-speech', () => ({
  speak: (text: string, options: unknown) => mockSpeak(text, options),
  stop: () => mockStop(),
}));

import { speak, stopSpeaking } from '@/assistant/speech/tts';

type SpeechOptions = {
  language?: string;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: () => void;
};
const optionsOfLastSpeak = () => mockSpeak.mock.calls[0][1] as SpeechOptions;

beforeEach(() => {
  mockSpeak.mockReset();
  mockStop.mockReset();
  mockStop.mockImplementation(async () => {});
});

describe('tts', () => {
  it('lit le texte en français', async () => {
    await speak('Il vous reste 40 sacs.');

    expect(mockSpeak).toHaveBeenCalledWith('Il vous reste 40 sacs.', expect.anything());
    expect(optionsOfLastSpeak().language).toBe('fr-FR');
  });

  it('attend l’arrêt du synthétiseur avant de parler', async () => {
    const order: string[] = [];
    mockStop.mockImplementation(async () => {
      order.push('stop');
    });
    mockSpeak.mockImplementation(() => {
      order.push('speak');
    });

    await speak('Enregistré.');

    expect(order).toEqual(['stop', 'speak']);
  });

  it('prévient la fin de lecture, qu’elle soit normale, coupée ou en erreur', async () => {
    const onEnd = jest.fn();

    await speak('Marge : 200 000 F CFA.', { onEnd });
    const options = optionsOfLastSpeak();

    options.onDone?.();
    options.onStopped?.();
    options.onError?.();
    expect(onEnd).toHaveBeenCalledTimes(3);
  });

  it('prévient la fin même quand le synthétiseur refuse de démarrer', async () => {
    const onEnd = jest.fn();
    mockSpeak.mockImplementation(() => {
      throw new Error('TTS indisponible');
    });

    await speak('Peu importe', { onEnd });

    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('n’explose pas quand le moteur est absent', async () => {
    mockStop.mockImplementation(async () => {
      throw new Error('pas de moteur');
    });

    await expect(speak('Peu importe')).resolves.toBeUndefined();
    await expect(stopSpeaking()).resolves.toBeUndefined();
  });

  it('arrête la lecture en cours', async () => {
    await stopSpeaking();

    expect(mockStop).toHaveBeenCalled();
  });
});
