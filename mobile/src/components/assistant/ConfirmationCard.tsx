/**
 * Confirmation card — the crux of trust. Structured, readable-without-reading,
 * and read aloud (TTS) when it appears. One green Confirmer, one Annuler. The
 * user's final action is a single tap; the AI only prepared the draft.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { tokens } from '@/theme';
import { speak } from '@/assistant/speech/tts';
import type { ConfirmationDraft } from '@/assistant/types';

export function ConfirmationCard({
  draft,
  onConfirm,
  onCancel,
}: {
  draft: ConfirmationDraft;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Read the card aloud as soon as it's shown.
  useEffect(() => {
    speak(draft.speech);
  }, [draft]);

  const accent =
    draft.risk === 'HIGH'
      ? tokens.colors.error
      : draft.risk === 'MEDIUM'
        ? tokens.colors.warning
        : tokens.colors.neutral[200];

  return (
    <View style={[styles.card, { borderTopColor: accent, borderTopWidth: 4 }]}>
      <View style={styles.head}>
        <Text style={styles.title}>{draft.title}</Text>
        {draft.risk !== 'LOW' ? (
          <View style={[styles.riskChip, { backgroundColor: accent }]}>
            <Text style={styles.riskChipText}>
              {draft.risk === 'HIGH' ? 'À vérifier' : 'Attention'}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.lines}>
        {draft.lines.map((l) => (
          <View key={l.label} style={styles.line}>
            <Text style={styles.lineLabel}>{l.label}</Text>
            <Text style={styles.lineValue} numberOfLines={1}>{l.value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Pressable style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.85 }]} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Annuler">
          <X size={20} color={tokens.colors.field.textMuted} />
          <Text style={styles.cancelText}>Annuler</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.confirm, pressed && { opacity: 0.9 }]} onPress={onConfirm} accessibilityRole="button" accessibilityLabel="Confirmer">
          <Check size={22} color={tokens.colors.neutral[0]} />
          <Text style={styles.confirmText}>Confirmer</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.xl, borderWidth: 1, borderColor: tokens.colors.neutral[200], padding: tokens.spacing[5], gap: tokens.spacing[4] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing[3] },
  title: { ...tokens.typography.headingMd, fontSize: 18, color: tokens.colors.field.text, flexShrink: 1 },
  riskChip: { paddingHorizontal: tokens.spacing[3], paddingVertical: tokens.spacing[1], borderRadius: tokens.radii.full },
  riskChipText: { ...tokens.typography.button, fontSize: 12, color: tokens.colors.neutral[0], letterSpacing: 0.3 },
  lines: { gap: tokens.spacing[2] },
  line: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: tokens.spacing[3] },
  lineLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  lineValue: { ...tokens.typography.numericSm, fontSize: 16, color: tokens.colors.field.text, flexShrink: 1 },
  actions: { flexDirection: 'row', gap: tokens.spacing[3], marginTop: tokens.spacing[1] },
  cancel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: tokens.spacing[2], minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], paddingHorizontal: tokens.spacing[5] },
  cancelText: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.field.textMuted },
  confirm: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: tokens.spacing[2], minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.primary[600] },
  confirmText: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.neutral[0] },
});
