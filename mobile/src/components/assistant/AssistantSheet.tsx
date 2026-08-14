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
import { useSpeechInput } from '@/assistant/speech/useSpeechInput';
import { speak } from '@/assistant/speech/tts';
import { ConfirmationCard } from './ConfirmationCard';
import { AnswerCard } from './AnswerCard';

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
  const speech = useSpeechInput({
    onFinal: (t) => {
      setText(t);
      void assistant.submit(t);
    },
  });

  // Stream interim voice results into the field so the user sees it in real time.
  useEffect(() => {
    if (speech.transcript) setText(speech.transcript);
  }, [speech.transcript]);

  // Reset the draft/message when the sheet opens.
  useEffect(() => {
    if (visible) {
      setText('');
      assistant.cancel();
    } else if (speech.listening) {
      speech.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Read clarification messages aloud too.
  useEffect(() => {
    if (assistant.message) speak(assistant.message);
  }, [assistant.message]);

  async function handleConfirm() {
    const ok = await assistant.confirm();
    if (ok) {
      speak('Enregistré.');
      onClose();
    }
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

          {assistant.thinking || assistant.submitting ? (
            <View style={styles.thinking}>
              <ActivityIndicator color={tokens.colors.primary[600]} />
              <Text style={styles.thinkingText}>
                {assistant.submitting ? 'Enregistrement…' : 'Jawdi réfléchit…'}
              </Text>
            </View>
          ) : assistant.answer ? (
            <AnswerCard
              answer={assistant.answer}
              onClose={() => {
                assistant.cancel();
                setText('');
              }}
            />
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
                {!speech.supported
                  ? 'Écrivez une saisie ou une question — ex. « dix sont morts » ou « quel est mon stock ? ».'
                  : speech.listening
                    ? 'Parlez maintenant…'
                    : 'Micro : dictez une saisie ou posez une question — ex. « dix sont morts » ou « quel est mon stock ? ».'}
              </Text>

              {/* Big mic: tap to listen (on-device FR); the field mirrors the
                  transcript. Hidden when the STT native module isn't in the
                  build — the text field below is the fallback. */}
              {speech.supported ? (
                <View style={styles.micRow}>
                  <Pressable
                    style={({ pressed }) => [styles.micCircle, speech.listening && styles.micCircleOn, pressed && { opacity: 0.85 }]}
                    onPress={() => (speech.listening ? speech.stop() : speech.start())}
                    accessibilityRole="button"
                    accessibilityLabel={speech.listening ? 'Arrêter l’écoute' : 'Parler à Jawdi'}
                  >
                    <Mic size={30} color={speech.listening ? tokens.colors.neutral[0] : tokens.colors.primary[700]} />
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={text}
                  onChangeText={setText}
                  placeholder="…ou tapez ici"
                  placeholderTextColor={tokens.colors.field.disabled}
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
  micRow: { alignItems: 'center', paddingVertical: tokens.spacing[2] },
  micCircle: { width: 84, height: 84, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.primary[50], borderWidth: 2, borderColor: tokens.colors.primary[600] },
  micCircleOn: { backgroundColor: tokens.colors.primary[600], borderColor: tokens.colors.primary[600] },
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
