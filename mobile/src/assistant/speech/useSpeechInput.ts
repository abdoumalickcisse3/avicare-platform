/**
 * Speech input — the stable seam for turning the user's voice into text.
 *
 * Phase 1 ships the **text fallback** (`supported: false`): the assistant sheet
 * renders an auto-focused TextInput, and the user dictates through the OS
 * keyboard's microphone (on-device French STT, offline on most phones). This
 * avoids pulling a native STT module now while keeping the interface identical
 * to a future on-device recognizer — swapping it in (Phase 2+) won't touch the
 * hook's consumers.
 */
import { useState } from 'react';

export interface SpeechInput {
  transcript: string;
  setTranscript: (t: string) => void;
  listening: boolean;
  /** Start on-device recognition (no-op in the text-fallback build). */
  start: () => void;
  stop: () => void;
  /** Whether an in-app recognizer is available (false → use the TextInput). */
  supported: boolean;
}

export function useSpeechInput(): SpeechInput {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);

  // No native recognizer wired in Phase 1 — keyboard dictation via TextInput.
  const start = () => setListening(true);
  const stop = () => setListening(false);

  return { transcript, setTranscript, listening, start, stop, supported: false };
}
