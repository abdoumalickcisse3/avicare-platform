/**
 * Assistant screen — Jawdi as a full page (not a popup). The field worker speaks
 * (keyboard mic) or types, Jawdi understands and prepares, and the last action is
 * a single "Confirmer" tap (write) or a spoken answer (read). Opened from the mic
 * FAB on the home and lot screens; an optional `unitId` param scopes it to a lot.
 * After a confirm or an answer it returns to the ask state so questions/entries
 * can be chained without leaving the page.
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Mic } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useAssistant } from '@/assistant/useAssistant';
import { useSpeechInput } from '@/assistant/speech/useSpeechInput';
import { speak } from '@/assistant/speech/tts';
import { ConfirmationCard } from '@/components/assistant/ConfirmationCard';
import { AnswerCard } from '@/components/assistant/AnswerCard';

export default function AssistantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId?: string }>();
  const unitId = params.unitId ? Number(params.unitId) : null;

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

  // Read clarification messages aloud.
  useEffect(() => {
    if (assistant.message) speak(assistant.message);
  }, [assistant.message]);

  // Back to the ask state (keep the page open so the worker can chain).
  function reset() {
    assistant.cancel();
    setText('');
  }

  async function handleConfirm() {
    const ok = await assistant.confirm();
    if (ok) {
      speak('Enregistré.');
      reset();
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={styles.back}
        >
          <ArrowLeft size={24} color={tokens.colors.field.text} />
        </Pressable>
        <View style={styles.brand}>
          <View style={styles.brandDot}>
            <Mic size={16} color={tokens.colors.primary[700]} />
          </View>
          <Text style={styles.brandText}>Jawdi</Text>
        </View>
        <View style={styles.back} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {assistant.thinking || assistant.submitting ? (
            <View style={styles.thinking}>
              <ActivityIndicator color={tokens.colors.primary[600]} />
              <Text style={styles.thinkingText}>
                {assistant.submitting ? 'Enregistrement…' : 'Jawdi réfléchit…'}
              </Text>
            </View>
          ) : assistant.answer ? (
            <AnswerCard answer={assistant.answer} onClose={reset} />
          ) : assistant.draft ? (
            <ConfirmationCard draft={assistant.draft} onConfirm={handleConfirm} onCancel={reset} />
          ) : assistant.unitChoice ? (
            <View style={styles.block}>
              <Text style={styles.prompt}>{assistant.message ?? 'Sur quel lot ?'}</Text>
              <View style={styles.chips}>
                {assistant.unitChoice.units.map((u) => (
                  <Pressable
                    key={u.id}
                    style={styles.chip}
                    onPress={() => assistant.chooseUnit(u.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Lot ${u.name}`}
                  >
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

              {speech.supported ? (
                <View style={styles.micRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.micCircle,
                      speech.listening && styles.micCircleOn,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => (speech.listening ? speech.stop() : speech.start())}
                    accessibilityRole="button"
                    accessibilityLabel={speech.listening ? 'Arrêter l’écoute' : 'Parler à Jawdi'}
                  >
                    <Mic
                      size={34}
                      color={speech.listening ? tokens.colors.neutral[0] : tokens.colors.primary[700]}
                    />
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.field.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  brandDot: {
    width: 30,
    height: 30,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { ...tokens.typography.headingMd, fontSize: 18, color: tokens.colors.field.text },
  content: { padding: tokens.spacing[5], gap: tokens.spacing[4], flexGrow: 1 },
  block: { gap: tokens.spacing[3] },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[6],
  },
  thinkingText: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  hint: { ...tokens.typography.bodyLg, color: tokens.colors.field.textMuted },
  micRow: { alignItems: 'center', paddingVertical: tokens.spacing[4] },
  micCircle: {
    width: 108,
    height: 108,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary[50],
    borderWidth: 2,
    borderColor: tokens.colors.primary[600],
  },
  micCircleOn: { backgroundColor: tokens.colors.primary[600], borderColor: tokens.colors.primary[600] },
  prompt: { ...tokens.typography.headingMd, fontSize: 16, color: tokens.colors.field.text },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing[2],
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    borderRadius: tokens.radii.lg,
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
    minHeight: 64,
  },
  input: { flex: 1, ...tokens.typography.bodyLg, color: tokens.colors.field.text, padding: 0 },
  error: { ...tokens.typography.bodySm, color: tokens.colors.error },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  chip: {
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
    borderRadius: tokens.radii.full,
    borderWidth: 1,
    borderColor: tokens.colors.primary[600],
    backgroundColor: tokens.colors.primary[50],
  },
  chipText: { ...tokens.typography.button, fontSize: 15, color: tokens.colors.primary[700] },
  go: {
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  goText: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.neutral[0] },
});
