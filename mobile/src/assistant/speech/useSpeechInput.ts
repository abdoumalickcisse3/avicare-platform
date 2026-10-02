/**
 * Speech input — real on-device recognition via `expo-speech-recognition` (French). Tap to
 * listen, interim results stream into `transcript`, and the caller is notified with the phrase
 * to send. Degrades gracefully (`supported: false` → the sheet falls back to a text field) when
 * the native module or the recognizer is unavailable, so the assistant is never blocked.
 *
 * The native module ('ExpoSpeechRecognition') only exists in a dev-client/build that bundled
 * expo-speech-recognition. On a build without it, a static import of the package throws at load —
 * which would crash every screen mounting the assistant. It's therefore loaded defensively; when
 * absent, the hook reports `supported: false` and the mic becomes a no-op.
 *
 * Three things the field taught us, each one a silent failure before:
 *
 * 1. The auto-send cannot wait for a final result. The OS ends a session on silence and does not
 *    always flag a last result as final, so a dictated phrase stayed in the box, never sent. The
 *    send now happens on `end` (always the last event, says the module's doc) when no final one
 *    came — unless the user stopped the mic themselves, which is not "I'm done talking".
 * 2. Network recognition is not a given. A recognizer that needs the network fails outright on a
 *    farm without it, so we start on-device whenever the phone says it can
 *    (`supportsOnDeviceRecognition`), and fall back to the network once — and only once — when the
 *    engine refuses (no French model installed, typically).
 * 3. A failure has to be visible. Every error used to be swallowed; the worker saw a mic that did
 *    nothing. Each code now maps to one sentence that says what to do instead.
 */
import { useCallback, useRef, useState } from 'react';

type RecognitionEventName = 'result' | 'end' | 'error';
interface SpeechModule {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (options: Record<string, unknown>) => void;
  stop: () => void;
  /** Both are absent from older builds of the module — always call them defensively. */
  supportsOnDeviceRecognition?: () => boolean;
  isRecognitionAvailable?: () => boolean;
}
type RecognitionEventHook = (event: RecognitionEventName, handler: (e: any) => void) => void;

let nativeModule: SpeechModule | null = null;
let nativeUseEvent: RecognitionEventHook | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('expo-speech-recognition');
  nativeModule = (mod?.ExpoSpeechRecognitionModule as SpeechModule) ?? null;
  nativeUseEvent = (mod?.useSpeechRecognitionEvent as RecognitionEventHook) ?? null;
} catch {
  nativeModule = null;
  nativeUseEvent = null;
}

/** True when the native STT module is available in this build. */
const MODULE_PRESENT = nativeModule != null && nativeUseEvent != null;

/** Error codes worth retrying on the other engine — the phrase itself was never the problem. */
const OTHER_ENGINE_MIGHT_WORK = ['network', 'service-not-allowed', 'language-not-supported'];

/**
 * What to tell the worker. Each sentence names the next move, because the fallback is always the
 * same: type it. `aborted` is the user's own stop, not a failure, so it says nothing.
 */
function sentenceFor(code: string): string | null {
  switch (code) {
    case 'aborted':
      return null;
    case 'not-allowed':
      return 'Micro refusé. Autorisez le micro dans les réglages du téléphone.';
    case 'network':
      return 'Pas de réseau pour la dictée. Tapez votre message.';
    case 'no-speech':
    case 'speech-timeout':
      return 'Je n’ai rien entendu. Réessayez.';
    case 'service-not-allowed':
    case 'language-not-supported':
      return 'La dictée en français n’est pas disponible sur ce téléphone. Tapez votre message.';
    default:
      return 'La dictée a échoué. Tapez votre message.';
  }
}

function canRecognize(): boolean {
  if (!MODULE_PRESENT) return false;
  try {
    return nativeModule?.isRecognitionAvailable?.() ?? true;
  } catch {
    return true;
  }
}

function canRecognizeOnDevice(): boolean {
  try {
    return nativeModule?.supportsOnDeviceRecognition?.() ?? false;
  } catch {
    return false;
  }
}

/**
 * Subscribe to a recognition event. Whether the native hook exists is fixed at module load, so
 * this branch is stable across renders (rules of hooks hold).
 */
function useRecognitionEvent(event: RecognitionEventName, handler: (e: any) => void): void {
  if (nativeUseEvent) nativeUseEvent(event, handler);
}

export interface SpeechInput {
  transcript: string;
  setTranscript: (t: string) => void;
  listening: boolean;
  start: () => void;
  stop: () => void;
  supported: boolean;
  /** One sentence to show the worker, or null when nothing went wrong. */
  error: string | null;
}

export function useSpeechInput(opts?: { onFinal?: (text: string) => void }): SpeechInput {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Asked once per hook instance: a device capability doesn't change mid-screen, and calling it
  // on every render would hit the native bridge for nothing.
  const [supported] = useState(canRecognize);

  // The handlers below are called by the native module, outside React's render flow, so what they
  // need to read lives in refs — state would be the value captured at subscription time.
  const latestTranscript = useRef('');
  const alreadySent = useRef(false);
  const stoppedByUser = useRef(false);
  const usingOnDevice = useRef(false);
  const alreadySwitchedEngine = useRef(false);
  const switchEngineOnEnd = useRef(false);

  const launch = useCallback((onDevice: boolean) => {
    if (!nativeModule) return;
    usingOnDevice.current = onDevice;
    setListening(true);
    try {
      nativeModule.start({
        lang: 'fr-FR',
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: onDevice,
      });
    } catch {
      setListening(false);
      setError(sentenceFor('unknown'));
    }
  }, []);

  const deliver = useCallback(
    (text: string) => {
      alreadySent.current = true;
      opts?.onFinal?.(text);
    },
    // The caller passes a fresh closure on every render; calling the latest one is what we want,
    // and depending on it would rebuild `start`/`stop` for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useRecognitionEvent('result', (e) => {
    const text = e.results?.[0]?.transcript ?? '';
    if (text) {
      latestTranscript.current = text;
      setTranscript(text);
    }
    if (e.isFinal) {
      setListening(false);
      if (text) deliver(text);
    }
  });

  useRecognitionEvent('error', (e) => {
    const code: string = e?.error ?? 'unknown';
    if (code === 'aborted' || stoppedByUser.current) return;
    if (
      OTHER_ENGINE_MIGHT_WORK.includes(code) &&
      !alreadySwitchedEngine.current &&
      (usingOnDevice.current || canRecognizeOnDevice())
    ) {
      // The recognizer must be fully disconnected before it can be started again, and `end` is
      // always the last event — so the second attempt waits for it.
      switchEngineOnEnd.current = true;
      return;
    }
    setError(sentenceFor(code));
  });

  useRecognitionEvent('end', () => {
    if (switchEngineOnEnd.current) {
      switchEngineOnEnd.current = false;
      alreadySwitchedEngine.current = true;
      launch(!usingOnDevice.current);
      return;
    }
    setListening(false);
    // The OS ended the session without ever flagging a final result: what was heard is still what
    // the worker said, so it goes through — unless they stopped the mic themselves.
    if (!alreadySent.current && !stoppedByUser.current && latestTranscript.current) {
      deliver(latestTranscript.current);
    }
  });

  const start = useCallback(async () => {
    if (!nativeModule) return;
    setError(null);
    try {
      const perm = await nativeModule.requestPermissionsAsync();
      if (!perm.granted) {
        setError(sentenceFor('not-allowed'));
        return;
      }
    } catch {
      setError(sentenceFor('unknown'));
      return;
    }
    latestTranscript.current = '';
    setTranscript('');
    alreadySent.current = false;
    stoppedByUser.current = false;
    alreadySwitchedEngine.current = false;
    switchEngineOnEnd.current = false;
    launch(canRecognizeOnDevice());
  }, [launch]);

  const stop = useCallback(() => {
    stoppedByUser.current = true;
    switchEngineOnEnd.current = false;
    try {
      nativeModule?.stop();
    } catch {
      // Already disconnected — `end` has nothing left to deliver either.
    }
    setListening(false);
  }, []);

  return { transcript, setTranscript, listening, start, stop, supported, error };
}
