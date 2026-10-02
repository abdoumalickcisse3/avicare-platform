/**
 * Text-to-speech — reads a Jawdi reply aloud, in French, when the worker asks for it.
 *
 * Reading every reply automatically was removed in August: it talked over people. The capability
 * itself is worth keeping — 11 of the 17 farmers surveyed keep a paper notebook — so it is now
 * driven by a tap (see {@link ../../components/assistant/SpeakButton}).
 *
 * Two things this wrapper owes its callers. It never throws into the UI: a phone without a French
 * voice simply stays silent, and the text is on screen anyway. And it tells the caller when the
 * reading is over — normally, interrupted, or failed — because the button has to go back to
 * "listen" on its own; without that it would stay stuck on "stop".
 */
import * as Speech from 'expo-speech';

export async function speak(text: string, opts?: { onEnd?: () => void }): Promise<void> {
  try {
    // `stop()` resolves once the synthesizer is actually free. Speaking before that swallows the
    // utterance on iOS — which is how a reply could be read aloud one time and not the next.
    await Speech.stop();
    Speech.speak(text, {
      language: 'fr-FR',
      rate: 0.98,
      onDone: opts?.onEnd,
      onStopped: opts?.onEnd,
      onError: opts?.onEnd,
    });
  } catch {
    // TTS unavailable — the reply is still fully readable on screen. Tell the caller, or its
    // button would wait for a reading that never started.
    opts?.onEnd?.();
  }
}

export async function stopSpeaking(): Promise<void> {
  try {
    await Speech.stop();
  } catch {
    // Nothing was playing, or the engine is gone — either way there is nothing to stop.
  }
}
