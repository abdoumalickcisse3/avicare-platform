/**
 * Text-to-speech — reads the confirmation card aloud (French). Wrapping
 * expo-speech keeps the "read the card" behaviour in one place and makes it a
 * no-op if TTS is unavailable, never throwing into the UI.
 */
import * as Speech from 'expo-speech';

export function speak(text: string): void {
  try {
    Speech.stop();
    Speech.speak(text, { language: 'fr-FR', rate: 0.98 });
  } catch {
    // TTS unavailable — the card is still fully readable visually.
  }
}

export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {
    // ignore
  }
}
