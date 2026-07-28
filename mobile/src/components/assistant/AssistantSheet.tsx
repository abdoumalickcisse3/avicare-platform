/**
 * Assistant bottom sheet — the field worker speaks (via the keyboard mic, Phase
 * 1) or types, Jawdi understands and prepares, and the last action is the
 * user's single "Confirmer" tap. Handles the two clarifications: unrecognized
 * phrase and ambiguous lot. On confirm, the entry goes through the offline
 * queue and the sheet closes with a spoken acknowledgement.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Mic, X } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useAssistant } from '@/assistant/useAssistant';
import { speak } from '@/assistant/speech/tts';
import { ConfirmationCard } from './ConfirmationCard';

export function AssistantSheet({
  visible,
  onClose,
  unitId,
}: {
  visible: boolean;
  onClose: () => void;
  unitId?: number | null;
}) {
  const assistant = useAssistant({ unitId });
  const [text, setText] = useState('');

  // Reset the draft/message when the sheet opens.
  useEffect(() => {
    if (visible) {
      setText('');
      assistant.cancel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Read clarification messages aloud too.
  useEffect(() => {
    if (assistant.message) speak(assistant.message);
  }, [assistant.message]);

  function handleConfirm() {
    assistant.confirm();
    speak('Enregistré.');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer l'assistant" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.brand}>
              <View style={styles.brandDot}><Mic size={16} color={tokens.colors.primary[700]} /></View>
              <Text style={styles.brandText}>Jawdi</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer">
              <X size={22} color={tokens.colors.field.textMuted} />
            </Pressable>
          </View>

          {assistant.thinking ? (
            <View style={styles.thinking}>
              <ActivityIndicator color={tokens.colors.primary[600]} />
              <Text style={styles.thinkingText}>Jawdi réfléchit…</Text>
            </View>
          ) : assistant.draft ? (
            <ConfirmationCard draft={assistant.draft} onConfirm={handleConfirm} onCancel={() => { assistant.cancel(); setText(''); }} />
          ) : assistant.unitChoice ? (
            <View style={styles.block}>
              <Text style={styles.prompt}>{assistant.message ?? 'Sur quel lot ?'}</Text>
              <View style={styles.chips}>
                {assistant.unitChoice.units.map((u) => (
                  <Pressable key={u.id} style={styles.chip} onPress={() => assistant.chooseUnit(u.id)} accessibilityRole="button" accessibilityLabel={`Lot ${u.name}`}>
                    <Text style={styles.chipText}>{u.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.block}>
              <Text style={styles.hint}>
                Appuyez sur le micro du clavier et parlez — ex. « dix sont morts ».
              </Text>
              <View style={styles.inputRow}>
                <Mic size={18} color={tokens.colors.field.textMuted} />
                <TextInput
                  style={styles.input}
                  value={text}
                  onChangeText={setText}
                  placeholder="Dites ce que vous voulez faire…"
                  placeholderTextColor={tokens.colors.field.disabled}
                  autoFocus
                  multiline
                  onSubmitEditing={() => assistant.submit(text)}
                  accessibilityLabel="Dictée assistant"
                />
              </View>
              {assistant.message ? <Text style={styles.error}>{assistant.message}</Text> : null}
              <Pressable
                style={({ pressed }) => [styles.go, (!text.trim() || pressed) && { opacity: 0.6 }]}
                onPress={() => assistant.submit(text)}
                disabled={!text.trim()}
                accessibilityRole="button"
                accessibilityLabel="Valider la phrase"
              >
                <Text style={styles.goText}>Continuer</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(18,43,18,0.35)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: tokens.colors.neutral[50], borderTopLeftRadius: tokens.radii.xl, borderTopRightRadius: tokens.radii.xl, padding: tokens.spacing[5], paddingBottom: tokens.spacing[8], gap: tokens.spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  brandDot: { width: 30, height: 30, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  brandText: { ...tokens.typography.headingMd, fontSize: 17, color: tokens.colors.field.text },
  block: { gap: tokens.spacing[3] },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], paddingVertical: tokens.spacing[5] },
  thinkingText: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  hint: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  prompt: { ...tokens.typography.headingMd, fontSize: 16, color: tokens.colors.field.text },
  inputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing[2], backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200], borderRadius: tokens.radii.lg, paddingHorizontal: tokens.spacing[3], paddingVertical: tokens.spacing[3], minHeight: 60 },
  input: { flex: 1, ...tokens.typography.bodyLg, color: tokens.colors.field.text, padding: 0 },
  error: { ...tokens.typography.bodySm, color: tokens.colors.error },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  chip: { paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[3], borderRadius: tokens.radii.full, borderWidth: 1, borderColor: tokens.colors.primary[600], backgroundColor: tokens.colors.primary[50] },
  chipText: { ...tokens.typography.button, fontSize: 15, color: tokens.colors.primary[700] },
  go: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.primary[600], alignItems: 'center', justifyContent: 'center' },
  goText: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.neutral[0] },
});
