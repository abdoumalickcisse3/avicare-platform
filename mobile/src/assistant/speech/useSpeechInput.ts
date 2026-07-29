/**
 * Speech input — real on-device recognition via `expo-speech-recognition`
 * (French). The keyboard-dictation fallback of Phase 1 is replaced by a true
 * in-app mic: tap to listen, interim results stream into `transcript`, and the
 * caller is notified on the final result. Degrades gracefully (`supported:false`,
 * → the sheet falls back to a text field) if the native module or permission is
 * unavailable — so the assistant is never blocked.
 */
import { useCallback, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

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

  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results?.[0]?.transcript ?? '';
    if (text) setTranscript(text);
    if (e.isFinal) {
      setListening(false);
      if (text) opts?.onFinal?.(text);
    }
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', () => setListening(false));

  const start = useCallback(async () => {
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) return;
      setTranscript('');
      setListening(true);
      ExpoSpeechRecognitionModule.start({
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
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }, []);

  return { transcript, setTranscript, listening, start, stop, supported: true };
}
