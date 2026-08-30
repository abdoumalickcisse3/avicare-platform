/**
 * The first-run tour.
 *
 * Three cards, skippable from the first one, shown once per role. It says what the app is for in
 * the words of the person holding the phone — not a feature list, and not a tooltip pinned to a
 * button, which on a five-inch screen covers the thing it is pointing at.
 *
 * It renders nothing until the seen-flag has been read. A tour that flashes on every cold start
 * while storage resolves is worse than no tour.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily, tokens } from '@/theme';
import { hasSeenTour, markTourSeen, stepsForRole } from './tour';

export function FieldTour({ farmRole }: { farmRole: string | undefined }) {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    hasSeenTour(farmRole)
      .then((seen) => {
        if (!cancelled && !seen) setVisible(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [farmRole]);

  const steps = stepsForRole(farmRole);
  const step = steps[index];
  const last = index === steps.length - 1;

  const close = () => {
    setVisible(false);
    markTourSeen(farmRole);
  };

  if (!visible || !step) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.counter}>
            {index + 1} / {steps.length}
          </Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>

          <View style={styles.dots}>
            {steps.map((s, i) => (
              <View key={s.title} style={[styles.dot, i === index && styles.dotOn]} />
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={last ? 'Commencer' : 'Suivant'}
            onPress={() => (last ? close() : setIndex((i) => i + 1))}
            style={styles.next}
          >
            <Text style={styles.nextText}>{last ? 'Commencer' : 'Suivant'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Passer la présentation"
            onPress={close}
            style={styles.skip}
          >
            <Text style={styles.skipText}>Passer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 25, 23, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.layout.screenPadding,
  },
  card: {
    width: '100%',
    borderRadius: tokens.radii.xl,
    backgroundColor: tokens.colors.field.background,
    padding: tokens.spacing[5],
    gap: tokens.spacing[3],
  },
  counter: { ...tokens.typography.label, color: tokens.colors.field.textMuted },
  title: { ...tokens.typography.headingLg, color: tokens.colors.field.text },
  body: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, lineHeight: 23 },
  dots: { flexDirection: 'row', gap: tokens.spacing[2], marginTop: tokens.spacing[1] },
  dot: {
    width: 8,
    height: 8,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.field.rule,
  },
  dotOn: { backgroundColor: tokens.colors.primary[600] },
  next: {
    minHeight: tokens.touch.primaryButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.commit.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.commit.border,
    marginTop: tokens.spacing[2],
  },
  nextText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
  skip: { minHeight: tokens.touch.secondary, alignItems: 'center', justifyContent: 'center' },
  skipText: { ...tokens.typography.button, color: tokens.colors.field.textMuted },
});
