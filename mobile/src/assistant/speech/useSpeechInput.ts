/**
 * Speech input — real on-device recognition via `expo-speech-recognition`
 * (French). The keyboard-dictation fallback of Phase 1 is replaced by a true
 * in-app mic: tap to listen, interim results stream into `transcript`, and the
 * caller is notified on the final result. Degrades gracefully (`supported:false`,
 * → the sheet falls back to a text field) if the native module or permission is
 * unavailable — so the assistant is never blocked.
 *
 * The native module ('ExpoSpeechRecognition') only exists in a dev-client/build
 * that bundled expo-speech-recognition. On a build without it, a static import
 * of the package throws at load — which would crash every screen mounting the
 * assistant. It's therefore loaded defensively; when absent, the hook reports
 * `supported: false` and the mic becomes a no-op.
 */
import { useCallback, useState } from 'react';

type RecognitionEventName = 'result' | 'end' | 'error';
interface SpeechModule {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (options: Record<string, unknown>) => void;
  stop: () => void;
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
const SUPPORTED = nativeModule != null && nativeUseEvent != null;

/**
 * Subscribe to a recognition event. Whether the native hook exists is fixed at
 * module load, so this branch is stable across renders (rules of hooks hold).
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
}

export function useSpeechInput(opts?: { onFinal?: (text: string) => void }): SpeechInput {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);

  useRecognitionEvent('result', (e) => {
    const text = e.results?.[0]?.transcript ?? '';
    if (text) setTranscript(text);
    if (e.isFinal) {
      setListening(false);
      if (text) opts?.onFinal?.(text);
    }
  });
  useRecognitionEvent('end', () => setListening(false));
  useRecognitionEvent('error', () => setListening(false));

  const start = useCallback(async () => {
    if (!nativeModule) return;
    try {
      const perm = await nativeModule.requestPermissionsAsync();
      if (!perm.granted) return;
      setTranscript('');
      setListening(true);
      nativeModule.start({
        lang: 'fr-FR',
        interimResults: true,
        continuous: false,
        // Allow the OS to fall back to network recognition when on-device
        // French isn't installed — better recall for the field.
        requiresOnDeviceRecognition: false,
      });
    } catch {
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    try {
      nativeModule?.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }, []);

  return { transcript, setTranscript, listening, start, stop, supported: SUPPORTED };
}
