/**
 * Answer card — the read-only counterpart of the ConfirmationCard. When the
 * field worker asks a question (stock, mortality, P&L…), the backend's
 * consultation loop returns a factual answer; there is nothing to confirm, so
 * this simply shows it and reads it aloud, with a single "Fermer" tap.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { tokens } from '@/theme';
import { speak } from '@/assistant/speech/tts';

export function AnswerCard({ answer, onClose }: { answer: string; onClose: () => void }) {
  // Read the answer aloud as soon as it appears.
  useEffect(() => {
    speak(answer);
  }, [answer]);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.dot}>
          <MessageCircle size={16} color={tokens.colors.primary[700]} />
        </View>
        <Text style={styles.title}>Réponse</Text>
      </View>
      <Text style={styles.body}>{answer}</Text>
      <Pressable
        style={({ pressed }) => [styles.close, pressed && { opacity: 0.85 }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fermer la réponse"
      >
        <Text style={styles.closeText}>Fermer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.primary[100],
    padding: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  dot: {
    width: 28,
    height: 28,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...tokens.typography.headingMd, fontSize: 16, color: tokens.colors.field.text },
  body: { ...tokens.typography.bodyLg, color: tokens.colors.field.text },
  close: {
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.neutral[0] },
});
