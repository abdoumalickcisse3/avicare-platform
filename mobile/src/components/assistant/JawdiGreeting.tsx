/**
 * Jawdi's entrance — the empty state of the assistant, played as someone arriving rather than
 * drawn as a page.
 *
 * The screen used to open on a finished block of text. A field worker who has never spoken to a
 * machine has no reason to believe there is anyone there, so the sequence borrows what makes a
 * human exchange legible: a wave, a pause where "Jawdi IA écrit…", then the sentences one at a
 * time, and only at the end the questions they can tap.
 *
 * Two deliberate restraints. Nothing is read aloud by itself — auto-speech was removed in August
 * for talking over people — so the greeting carries a speaker button and waits to be asked. And
 * when the phone asks for less motion, the whole scene is simply already there: the sequence is
 * decoration, never the only way to learn what Jawdi is.
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/theme';
import { SpeakButton } from '@/components/assistant/SpeakButton';
import { JawdiFace } from '@/components/assistant/JawdiFace';

const GREETING = 'Bonjour 👋';
const INTRODUCTION = 'Je suis Jawdi IA, votre conseiller d’élevage.';
const OFFER =
  'Posez-moi une question, ou dictez une action — je m’appuie sur vos données réelles.';
/** What the speaker button says: the 👋 is for the eyes, not for the ear. */
const SPOKEN = `Bonjour. ${INTRODUCTION} ${OFFER}`;

/** When each line lands, in ms from mount. The first gap is the "someone is typing" beat. */
const BEATS = [520, 980, 1420, 1720] as const;
const PLAYED_OUT = BEATS.length;

export function JawdiGreeting({
  suggestions,
  onPick,
}: {
  suggestions: readonly string[];
  onPick: (s: string) => void;
}) {
  // 0 = still typing; each step reveals one more line; PLAYED_OUT = the whole scene.
  const [beat, setBeat] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const playEverythingAtOnce = () => {
      if (cancelled) return;
      setReduced(true);
      setBeat(PLAYED_OUT);
    };
    AccessibilityInfo.isReduceMotionEnabled()
      .then((wantsLessMotion) => {
        if (cancelled) return;
        if (wantsLessMotion) {
          playEverythingAtOnce();
          return;
        }
        BEATS.forEach((at, i) => timers.push(setTimeout(() => setBeat(i + 1), at)));
      })
      // No answer from the OS is not a reason to withhold the greeting.
      .catch(playEverythingAtOnce);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <View style={styles.wrap}>
      <Hand reduced={reduced} />
      {beat === 0 ? (
        <Typing />
      ) : (
        <>
          {beat >= 1 ? (
            <Line reduced={reduced} style={styles.hello}>
              {GREETING}
            </Line>
          ) : null}
          {beat >= 2 ? (
            <Line reduced={reduced} style={styles.intro}>
              {INTRODUCTION}
            </Line>
          ) : null}
          {beat >= 3 ? (
            <Line reduced={reduced} style={styles.offer}>
              {OFFER}
            </Line>
          ) : null}
          {beat >= PLAYED_OUT ? (
            <>
              <SpeakButton text={SPOKEN} />
              <View style={styles.chips}>
                {suggestions.map((s) => (
                  <Pressable key={s} style={styles.chip} onPress={() => onPick(s)}>
                    <Text style={styles.chipText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

/** The person arriving: the same face as the button, popping in and waving on their own. */
function Hand({ reduced }: { reduced: boolean }) {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      enter.setValue(1);
      return;
    }
    Animated.timing(enter, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: true,
    }).start();
  }, [enter, reduced]);

  return (
    <Animated.View style={{ opacity: enter, transform: [{ scale: enter }] }}>
      <JawdiFace size={72} animated={!reduced} />
    </Animated.View>
  );
}

/** The three dots that say a person is composing — the pause that makes the rest feel spoken. */
function Typing() {
  const dots = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ];
  useEffect(() => {
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.typingRow} accessibilityRole="text">
      <Text style={styles.typingText}>Jawdi IA écrit…</Text>
      <View style={styles.dots}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: d }]} />
        ))}
      </View>
    </View>
  );
}

/** One spoken line, fading up as it lands. */
function Line({
  children,
  style,
  reduced,
}: {
  children: string;
  style: object;
  reduced: boolean;
}) {
  const appear = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    Animated.timing(appear, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [appear, reduced]);

  return (
    <Animated.Text
      style={[
        style,
        { opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
      ]}
    >
      {children}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: tokens.spacing[10], gap: tokens.spacing[3] },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], minHeight: 40 },
  typingText: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.colors.primary[500] },
  hello: { ...tokens.typography.headingLg, color: tokens.colors.field.text, textAlign: 'center' },
  intro: {
    ...tokens.typography.headingMd,
    color: tokens.colors.primary[700],
    textAlign: 'center',
    paddingHorizontal: tokens.spacing[4],
  },
  offer: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.textMuted,
    textAlign: 'center',
    paddingHorizontal: tokens.spacing[6],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[4],
    marginTop: tokens.spacing[2],
  },
  chip: {
    paddingVertical: tokens.spacing[2],
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radii.full,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  chipText: { ...tokens.typography.bodyMd, color: tokens.colors.primary[700] },
});
