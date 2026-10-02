import { act, renderHook } from '@testing-library/react-native';

/**
 * The mic is the field worker's only hands-free input, and its failures used to be silent:
 * every catch swallowed, no error state, and an auto-send that depended on a final result the
 * OS does not always deliver. These tests pin the three behaviours that were missing.
 */

type Handler = (event: unknown) => void;
const handlers: Record<string, Handler> = {};
const mockStart = jest.fn();
const mockStop = jest.fn();
const mockRequestPermissions = jest.fn(async () => ({ granted: true }));
const mockSupportsOnDevice = jest.fn(() => true);
const mockIsAvailable = jest.fn(() => true);

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    start: (options: unknown) => mockStart(options),
    stop: () => mockStop(),
    requestPermissionsAsync: () => mockRequestPermissions(),
    supportsOnDeviceRecognition: () => mockSupportsOnDevice(),
    isRecognitionAvailable: () => mockIsAvailable(),
  },
  useSpeechRecognitionEvent: (event: string, handler: Handler) => {
    handlers[event] = handler;
  },
}));

import { useSpeechInput } from '@/assistant/speech/useSpeechInput';

/**
 * React 19 + RNTL 14: a synchronous `act` leaves the state queue unflushed, so the hook's
 * result still shows the previous render. Every event has to be fired inside an awaited
 * async `act`.
 */
const fire = (event: string, payload: unknown = {}) =>
  act(async () => {
    handlers[event]?.(payload);
  });
const said = (transcript: string, isFinal: boolean) => ({ isFinal, results: [{ transcript }] });

async function listening(onFinal = jest.fn()) {
  const hook = await renderHook(() => useSpeechInput({ onFinal }));
  await act(async () => hook.result.current.start());
  return { hook, onFinal };
}

beforeEach(() => {
  mockStart.mockReset();
  mockStop.mockReset();
  mockRequestPermissions.mockImplementation(async () => ({ granted: true }));
  mockSupportsOnDevice.mockReturnValue(true);
  mockIsAvailable.mockReturnValue(true);
});

describe('useSpeechInput — envoi de la phrase dictée', () => {
  it('envoie le résultat final', async () => {
    const { hook, onFinal } = await listening();

    await fire('result', said('trente morts aujourd’hui', true));

    expect(onFinal).toHaveBeenCalledWith('trente morts aujourd’hui');
    expect(hook.result.current.listening).toBe(false);
  });

  it('envoie quand même si l’OS coupe sans jamais marquer de résultat final', async () => {
    const { hook, onFinal } = await listening();

    await fire('result', said('quarante sacs d’aliment', false));
    await fire('end');

    expect(onFinal).toHaveBeenCalledWith('quarante sacs d’aliment');
    expect(hook.result.current.listening).toBe(false);
  });

  it('n’envoie rien quand c’est l’utilisateur qui arrête, mais garde le texte', async () => {
    const { hook, onFinal } = await listening();

    await fire('result', said('je réfléchis', false));
    await act(async () => hook.result.current.stop());
    await fire('end');

    expect(onFinal).not.toHaveBeenCalled();
    expect(hook.result.current.transcript).toBe('je réfléchis');
  });

  it('n’envoie pas deux fois quand le final est suivi du end', async () => {
    const { onFinal } = await listening();

    await fire('result', said('cinq morts', true));
    await fire('end');

    expect(onFinal).toHaveBeenCalledTimes(1);
  });
});

describe('useSpeechInput — reconnaissance embarquée puis réseau', () => {
  it('démarre en embarqué quand le téléphone le sait faire', async () => {
    await listening();

    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({ lang: 'fr-FR', requiresOnDeviceRecognition: true }),
    );
  });

  it('démarre en réseau quand le téléphone ne sait pas faire d’embarqué', async () => {
    mockSupportsOnDevice.mockReturnValue(false);

    await listening();

    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({ requiresOnDeviceRecognition: false }),
    );
  });

  it('bascule sur le réseau quand le modèle français embarqué manque', async () => {
    const { hook } = await listening();

    await fire('error', { error: 'service-not-allowed' });
    await fire('end');

    expect(mockStart).toHaveBeenCalledTimes(2);
    expect(mockStart).toHaveBeenLastCalledWith(
      expect.objectContaining({ requiresOnDeviceRecognition: false }),
    );
    expect(hook.result.current.error).toBeNull();
  });

  it('ne bascule qu’une fois, puis le dit', async () => {
    const { hook } = await listening();

    await fire('error', { error: 'service-not-allowed' });
    await fire('end');
    await fire('error', { error: 'network' });
    await fire('end');

    expect(mockStart).toHaveBeenCalledTimes(2);
    expect(hook.result.current.listening).toBe(false);
    expect(hook.result.current.error).toContain('réseau');
  });
});

describe('useSpeechInput — les pannes se voient', () => {
  it('dit que le micro est refusé, sans démarrer', async () => {
    mockRequestPermissions.mockImplementation(async () => ({ granted: false }));

    const { hook } = await listening();

    expect(mockStart).not.toHaveBeenCalled();
    expect(hook.result.current.error).toContain('Micro');
    expect(hook.result.current.listening).toBe(false);
  });

  it('dit qu’il n’a rien entendu, sans relancer', async () => {
    const { hook } = await listening();

    await fire('error', { error: 'no-speech' });
    await fire('end');

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(hook.result.current.error).toContain('entendu');
  });

  it('ne dit rien quand l’erreur est l’arrêt demandé', async () => {
    const { hook } = await listening();

    await act(async () => hook.result.current.stop());
    await fire('error', { error: 'aborted' });
    await fire('end');

    expect(hook.result.current.error).toBeNull();
  });

  it('efface l’erreur précédente au démarrage suivant', async () => {
    mockRequestPermissions.mockImplementation(async () => ({ granted: false }));
    const { hook } = await listening();
    expect(hook.result.current.error).not.toBeNull();

    mockRequestPermissions.mockImplementation(async () => ({ granted: true }));
    await act(async () => hook.result.current.start());

    expect(hook.result.current.error).toBeNull();
  });

  it('cache le micro quand le téléphone n’a pas de reconnaissance', async () => {
    mockIsAvailable.mockReturnValue(false);

    const hook = await renderHook(() => useSpeechInput());

    expect(hook.result.current.supported).toBe(false);
  });
});
