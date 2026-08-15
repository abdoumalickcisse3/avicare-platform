/**
 * Jawdi IA — the conversational advisor as a full page (not a popup). Any farm
 * member reaches it; the tools it can use stay RBAC-scoped server-side, so the
 * same chat adapts to each role. The worker speaks (in-app mic) or types, Jawdi
 * answers from the farm's real data, advises, and — for a dictated action —
 * shows a card confirmed by one tap. Light-glassmorphism to match the web.
 *
 * Opened from the mic FAB on home/lot screens; an optional `unitId` scopes the
 * conversation to a lot. Multi-turn: the whole thread is replayed each request.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
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
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSelector } from 'react-redux';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, Mic, Send, Sparkles, X } from 'lucide-react-native';
import { tokens } from '@/theme';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import {
  useChatMutation,
  useConfirmActionMutation,
  type ChatTurn,
  type Risk,
} from '@/store/api/assistantApi';
import { useSpeechInput } from '@/assistant/speech/useSpeechInput';
import { speak } from '@/assistant/speech/tts';

type Kind = 'ANSWER' | 'DRAFT' | 'CLARIFICATION';
type DraftStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  kind?: Kind;
  text?: string;
  action?: string | null;
  summary?: string | null;
  risk?: Risk | null;
  claimId?: string | null;
  status?: DraftStatus;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const SUGGESTIONS = [
  'Comment va mon élevage ?',
  'Mon stock d’aliment',
  'Résultat du mois',
  'Qui me doit de l’argent ?',
  'Vaccins à faire',
];

const RISK: Record<Risk, { label: string; color: string }> = {
  LOW: { label: 'À confirmer', color: tokens.colors.primary[600] },
  MEDIUM: { label: 'À vérifier', color: tokens.colors.accent[600] },
  HIGH: { label: 'Attention', color: tokens.colors.error },
};

function toThread(messages: Msg[]): ChatTurn[] {
  return messages
    .map((m) => ({ role: m.role, text: (m.text ?? m.summary ?? '').trim() }))
    .filter((t) => t.text.length > 0)
    .slice(-40);
}

export default function AssistantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId?: string }>();
  const unitId = params.unitId ? Number(params.unitId) : null;
  const farmId = useSelector(selectSelectedFarmId);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [chat, { isLoading }] = useChatMutation();
  const [confirmAction] = useConfirmActionMutation();
  const scrollRef = useRef<ScrollView>(null);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || isLoading) return;
      if (farmId == null) {
        setMessages((m) => [
          ...m,
          { id: uid(), role: 'assistant', kind: 'CLARIFICATION', text: 'Sélectionnez d’abord une ferme.' },
        ]);
        return;
      }
      const withUser: Msg[] = [...messages, { id: uid(), role: 'user', text }];
      setMessages(withUser);
      setInput('');
      try {
        const res = await chat({ farmId, messages: toThread(withUser), unitId }).unwrap();
        const reply: Msg =
          res.kind === 'DRAFT'
            ? {
                id: uid(),
                role: 'assistant',
                kind: 'DRAFT',
                action: res.action,
                summary: res.summary,
                risk: res.risk ?? 'MEDIUM',
                claimId: res.claimId,
                status: 'pending',
              }
            : { id: uid(), role: 'assistant', kind: res.kind, text: res.message ?? '' };
        setMessages((m) => [...m, reply]);
        if (reply.text) speak(reply.text);
      } catch {
        setMessages((m) => [
          ...m,
          { id: uid(), role: 'assistant', kind: 'CLARIFICATION', text: 'Connexion interrompue. Réessayez.' },
        ]);
      }
    },
    [chat, farmId, unitId, isLoading, messages],
  );

  // Voice: onFinal reads the latest `send` via a ref (send's identity changes
  // with the thread), so a dictated phrase always posts the current context.
  const sendRef = useRef(send);
  sendRef.current = send;
  const speech = useSpeechInput({ onFinal: (t) => void sendRef.current(t) });
  useEffect(() => {
    if (speech.transcript) setInput(speech.transcript);
  }, [speech.transcript]);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [messages, isLoading]);

  const confirm = useCallback(
    async (msg: Msg) => {
      if (!msg.claimId || farmId == null) return;
      try {
        const r = await confirmAction({ farmId, claimId: msg.claimId }).unwrap();
        speak('Enregistré.');
        setMessages((ms) =>
          ms
            .map((x) => (x.id === msg.id ? { ...x, status: 'confirmed' as DraftStatus } : x))
            .concat({ id: uid(), role: 'assistant', kind: 'ANSWER', text: `Enregistré : ${r.summary}` }),
        );
      } catch {
        setMessages((ms) => ms.map((x) => (x.id === msg.id ? { ...x, status: 'expired' as DraftStatus } : x)));
      }
    },
    [confirmAction, farmId],
  );

  const cancel = (msg: Msg) =>
    setMessages((ms) => ms.map((x) => (x.id === msg.id ? { ...x, status: 'cancelled' } : x)));

  const empty = messages.length === 0;

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#EAF3E7', '#F7FAF6', '#FFFFFF']} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['top']} style={styles.flex}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Retour" style={styles.iconBtn}>
            <ArrowLeft size={24} color={tokens.colors.field.text} />
          </Pressable>
          <View style={styles.brand}>
            <Avatar />
            <View>
              <Text style={styles.brandText}>Jawdi IA</Text>
              <View style={styles.statusRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.statusText}>Conseiller · en ligne</Text>
              </View>
            </View>
          </View>
          <View style={styles.iconBtn} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}
          style={styles.flex}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.threadScroll}
            contentContainerStyle={styles.thread}
            keyboardShouldPersistTaps="handled"
          >
            {empty ? (
              <Welcome onPick={send} />
            ) : (
              messages.map((m) =>
                m.role === 'user' ? (
                  <UserBubble key={m.id} text={m.text ?? ''} />
                ) : m.kind === 'DRAFT' ? (
                  <DraftCard key={m.id} msg={m} onConfirm={() => confirm(m)} onCancel={() => cancel(m)} />
                ) : (
                  <AssistantBubble key={m.id} text={m.text ?? ''} />
                ),
              )
            )}
            {isLoading ? <Thinking /> : null}
          </ScrollView>

          {/* Suggestions */}
          {!empty ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.suggestionsBar}
              contentContainerStyle={styles.suggestions}
              keyboardShouldPersistTaps="handled"
            >
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} style={styles.chip} onPress={() => send(s)}>
                  <Text style={styles.chipText}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {/* Input bar */}
          <Glass radius={26} style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={speech.listening ? 'Je vous écoute…' : 'Posez une question, dictez une action…'}
              placeholderTextColor={tokens.colors.field.disabled}
              multiline
              accessibilityLabel="Message pour Jawdi"
            />
            {speech.supported ? (
              <MicButton
                listening={speech.listening}
                onPress={() => (speech.listening ? speech.stop() : speech.start())}
              />
            ) : null}
            <Pressable
              onPress={() => send(input)}
              disabled={!input.trim() || isLoading}
              accessibilityLabel="Envoyer"
              style={[styles.sendBtn, (!input.trim() || isLoading) && { opacity: 0.4 }]}
            >
              <Send size={20} color={tokens.colors.neutral[0]} />
            </Pressable>
          </Glass>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/* ------------------------------------------------------------- pieces */

function Avatar({ size = 40 }: { size?: number }) {
  return (
    <LinearGradient
      colors={[tokens.colors.primary[500], tokens.colors.primary[700]]}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Sparkles size={size * 0.5} color={tokens.colors.neutral[0]} />
    </LinearGradient>
  );
}

/**
 * Frosted-glass surface. The passed `style` (padding, flexDirection, margins…)
 * is applied to THIS view — the one that lays out the children — so callers get
 * real layout; the blur sits behind, the children above it.
 */
function Glass({
  children,
  style,
  radius = 18,
}: {
  children: React.ReactNode;
  style?: object;
  radius?: number;
}) {
  return (
    <View style={[styles.glass, { borderRadius: radius }, style]}>
      <BlurView intensity={24} tint="light" style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <View style={styles.userRow}>
      <LinearGradient
        colors={[tokens.colors.primary[500], tokens.colors.primary[700]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.userBubble}
      >
        <Text style={styles.userText}>{text}</Text>
      </LinearGradient>
    </View>
  );
}

function AssistantBubble({ text }: { text: string }) {
  return (
    <View style={styles.assistantRow}>
      <Avatar size={30} />
      <Glass radius={18} style={styles.assistantBubble}>
        <Text style={styles.assistantText}>{text}</Text>
      </Glass>
    </View>
  );
}

function DraftCard({ msg, onConfirm, onCancel }: { msg: Msg; onConfirm: () => void; onCancel: () => void }) {
  const risk = RISK[msg.risk ?? 'MEDIUM'];
  const done = msg.status && msg.status !== 'pending';
  return (
    <View style={styles.assistantRow}>
      <Avatar size={30} />
      <Glass radius={18} style={styles.draftCard}>
        <View style={styles.draftHead}>
          <View style={[styles.riskBadge, { borderColor: risk.color }]}>
            <Text style={[styles.riskText, { color: risk.color }]}>{risk.label.toUpperCase()}</Text>
          </View>
          <Text style={styles.draftAction}>{msg.action}</Text>
        </View>
        <Text style={styles.draftSummary}>{msg.summary}</Text>

        {done ? (
          <Text
            style={[
              styles.draftDone,
              {
                color:
                  msg.status === 'confirmed'
                    ? tokens.colors.primary[700]
                    : msg.status === 'expired'
                      ? tokens.colors.error
                      : tokens.colors.field.textMuted,
              },
            ]}
          >
            {msg.status === 'confirmed'
              ? '✓ Enregistré'
              : msg.status === 'expired'
                ? 'Expiré — reformulez pour réessayer'
                : 'Annulé'}
          </Text>
        ) : (
          <View style={styles.draftActions}>
            <Pressable onPress={onConfirm} style={styles.confirmBtn} accessibilityLabel="Confirmer">
              <Check size={20} color={tokens.colors.neutral[0]} />
              <Text style={styles.confirmText}>Confirmer</Text>
            </Pressable>
            <Pressable onPress={onCancel} style={styles.cancelBtn} accessibilityLabel="Annuler">
              <X size={18} color={tokens.colors.field.textMuted} />
              <Text style={styles.cancelText}>Annuler</Text>
            </Pressable>
          </View>
        )}
      </Glass>
    </View>
  );
}

function Thinking() {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];
  useEffect(() => {
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={styles.assistantRow}>
      <Avatar size={30} />
      <Glass radius={16} style={styles.thinking}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: d }]} />
        ))}
      </Glass>
    </View>
  );
}

function MicButton({ listening, onPress }: { listening: boolean; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!listening) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  return (
    <Pressable onPress={onPress} accessibilityLabel={listening ? 'Arrêter l’écoute' : 'Parler à Jawdi'} style={styles.micWrap}>
      {listening ? (
        <Animated.View style={[styles.micHalo, { transform: [{ scale }], opacity }]} />
      ) : null}
      <View style={[styles.micBtn, listening && styles.micBtnOn]}>
        <Mic size={22} color={listening ? tokens.colors.neutral[0] : tokens.colors.primary[700]} />
      </View>
    </Pressable>
  );
}

function Welcome({ onPick }: { onPick: (s: string) => void }) {
  return (
    <View style={styles.welcome}>
      <Avatar size={72} />
      <Text style={styles.welcomeTitle}>Bonjour, je suis Jawdi.</Text>
      <Text style={styles.welcomeSub}>
        Votre conseiller d’élevage. Posez une question sur votre ferme, ou dictez une action — je m’appuie sur vos données réelles.
      </Text>
      <View style={styles.welcomeChips}>
        {SUGGESTIONS.map((s) => (
          <Pressable key={s} style={styles.chip} onPress={() => onPick(s)}>
            <Text style={styles.chipText}>{s}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------- styles */

const GLASS_TINT = 'rgba(255,255,255,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.85)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7FAF6' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[2],
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  brandText: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: tokens.colors.primary[500] },
  statusText: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  avatar: { alignItems: 'center', justifyContent: 'center' },

  threadScroll: { flex: 1 },
  thread: { padding: tokens.spacing[4], gap: tokens.spacing[4], flexGrow: 1 },

  welcome: { alignItems: 'center', gap: tokens.spacing[4], paddingTop: tokens.spacing[10], paddingHorizontal: tokens.spacing[3] },
  welcomeTitle: { ...tokens.typography.displayMd, color: tokens.colors.field.text, textAlign: 'center' },
  welcomeSub: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', maxWidth: 320 },
  welcomeChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: tokens.spacing[2], marginTop: tokens.spacing[2] },

  userRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '85%',
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
    borderRadius: 20,
    borderBottomRightRadius: 6,
  },
  userText: { ...tokens.typography.bodyLg, color: tokens.colors.neutral[0] },

  assistantRow: { flexDirection: 'row', alignItems: 'flex-end', gap: tokens.spacing[2], maxWidth: '92%' },
  assistantBubble: { paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[3], borderBottomLeftRadius: 6, flexShrink: 1 },
  assistantText: { ...tokens.typography.bodyLg, color: tokens.colors.field.text },

  glass: { overflow: 'hidden', borderWidth: 1, borderColor: GLASS_BORDER, backgroundColor: GLASS_TINT },

  draftCard: { padding: tokens.spacing[4], borderBottomLeftRadius: 6, flexShrink: 1, gap: tokens.spacing[2] },
  draftHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: tokens.radii.full, borderWidth: 1 },
  riskText: { fontFamily: tokens.typography.label.fontFamily, fontSize: 10, letterSpacing: 0.6 },
  draftAction: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  draftSummary: { ...tokens.typography.headingMd, fontSize: 17, color: tokens.colors.field.text },
  draftDone: { ...tokens.typography.bodyMd, marginTop: tokens.spacing[1] },
  draftActions: { flexDirection: 'row', gap: tokens.spacing[2], marginTop: tokens.spacing[2] },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    minHeight: 52,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.primary[600],
  },
  confirmText: { ...tokens.typography.button, color: tokens.colors.neutral[0] },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tokens.spacing[4],
    minHeight: 52,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
  },
  cancelText: { ...tokens.typography.button, color: tokens.colors.field.textMuted },

  thinking: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[3], borderBottomLeftRadius: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colors.primary[500] },

  suggestionsBar: { flexGrow: 0, marginBottom: tokens.spacing[2] },
  suggestions: { paddingHorizontal: tokens.spacing[4], alignItems: 'center', gap: tokens.spacing[2] },
  chip: {
    alignSelf: 'center',
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[2],
    borderRadius: tokens.radii.full,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: tokens.colors.primary[200],
  },
  chipText: { ...tokens.typography.bodyMd, color: tokens.colors.primary[700] },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    minHeight: 60,
    marginHorizontal: tokens.spacing[4],
    marginBottom: tokens.spacing[3],
    paddingLeft: tokens.spacing[4],
    paddingRight: tokens.spacing[2],
    paddingVertical: tokens.spacing[2],
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderColor: 'rgba(36,85,36,0.14)',
  },
  input: { flex: 1, ...tokens.typography.bodyLg, color: tokens.colors.field.text, paddingVertical: tokens.spacing[1], maxHeight: 120 },
  micWrap: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  micHalo: { position: 'absolute', width: 46, height: 46, borderRadius: 23, backgroundColor: tokens.colors.accent[400] },
  micBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: tokens.colors.primary[200],
  },
  micBtnOn: { backgroundColor: tokens.colors.accent[400], borderColor: tokens.colors.accent[400] },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.primary[600],
  },
});
