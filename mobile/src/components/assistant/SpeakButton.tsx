/**
 * Speak button — the one gesture that makes Jawdi talk.
 *
 * Deliberately per-reply and opt-in: the assistant used to read every answer aloud by itself and
 * that was removed for talking over people. A worker who cannot comfortably read the screen taps
 * once to hear it, once more to cut it short.
 *
 * Each button owns its own state. Starting a second reading stops the first one, and that first
 * button returns to "listen" through the `onEnd` the engine fires on interruption — so two
 * buttons never both claim to be playing.
 */
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Square, Volume2 } from 'lucide-react-native';
import { tokens } from '@/theme';
import { speak, stopSpeaking } from '@/assistant/speech/tts';

export function SpeakButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);

  const toggle = () => {
    if (speaking) {
      setSpeaking(false);
      void stopSpeaking();
      return;
    }
    setSpeaking(true);
    void speak(text, { onEnd: () => setSpeaking(false) });
  };

  // Nothing to read: a draft without a summary, or a reply still streaming in.
  if (!text.trim()) return null;

  return (
    <Pressable
      onPress={toggle}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={speaking ? 'Arrêter la lecture' : 'Écouter à voix haute'}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
    >
      {speaking ? (
        <Square size={14} color={tokens.colors.primary[700]} fill={tokens.colors.primary[700]} />
      ) : (
        <Volume2 size={16} color={tokens.colors.primary[700]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'flex-start',
    width: 28,
    height: 28,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary[50],
  },
});
