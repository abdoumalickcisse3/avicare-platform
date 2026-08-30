/**
 * The counter of design direction §5 — "anatomie du compteur" — finally built.
 *
 * `touch.counterPrimary` (96dp) and `typography.numeric` (64dp) have been in the tokens
 * since the field design was written, describing this component, with nothing implementing
 * them: the entry screens used a plain `TextInput`. A number typed on a phone keyboard, in
 * a barn, with one hand and a dead bird in the other, is the wrong interaction.
 *
 * Three decisions the tokens imply and this component honours:
 *
 * - **The pads are 96dp** — roughly 15mm, the size the direction gives for "a control tapped
 *   dozens of times in a row". The decrement is deliberately the same size: a smaller one
 *   would be a target you miss precisely when correcting a mistake.
 * - **Long press steps by ten.** Counting forty deaths is otherwise forty taps, and forty
 *   taps is how people stop counting and start estimating.
 * - **A disabled pad stays in the layout.** Removing it would slide the other pad under a
 *   thumb already on its way down.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Minus, Plus } from 'lucide-react-native';
import { tokens } from '@/theme';

/** Milliseconds before a press becomes a long press. */
const LONG_PRESS_MS = 400;
/** How much a long press moves, relative to `step`. */
const LONG_PRESS_FACTOR = 10;

export type CounterProps = {
  value: number;
  onChange: (next: number) => void;
  label: string;
  /** Increment of a single tap. Defaults to 1. */
  step?: number;
  /** Floor, inclusive. Defaults to 0 — no field quantity is negative. */
  min?: number;
  /** Ceiling, inclusive. Omitted means unbounded. */
  max?: number;
  /** Shown under the value; the caller's place for a unit or a hint. */
  helperText?: string;
};

export function Counter({
  value,
  onChange,
  label,
  step = 1,
  min = 0,
  max,
  helperText,
}: CounterProps) {
  // A long press must not also fire the tap that ends it.
  const [longPressed, setLongPressed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const clamp = useCallback(
    (next: number) => {
      const floored = Math.max(next, min);
      return max === undefined ? floored : Math.min(floored, max);
    },
    [min, max],
  );

  const apply = useCallback(
    (delta: number) => {
      const next = clamp(value + delta);
      if (next === value) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(next);
    },
    [value, clamp, onChange],
  );

  const canDecrement = value > min;
  const canIncrement = max === undefined || value < max;

  const press = (direction: 1 | -1) => () => {
    if (longPressed) {
      setLongPressed(false);
      return;
    }
    apply(direction * step);
  };

  const longPress = (direction: 1 | -1) => () => {
    setLongPressed(true);
    apply(direction * step * LONG_PRESS_FACTOR);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.row}>
        <Pressable
          onPress={press(-1)}
          onLongPress={longPress(-1)}
          delayLongPress={LONG_PRESS_MS}
          disabled={!canDecrement}
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${step}`}
          accessibilityHint={`Appui long : retirer ${step * LONG_PRESS_FACTOR}`}
          style={({ pressed }) => [
            styles.pad,
            styles.padSecondary,
            pressed && canDecrement && styles.padPressed,
            !canDecrement && styles.padDisabled,
          ]}
        >
          <Minus
            size={32}
            color={canDecrement ? tokens.colors.field.text : tokens.colors.field.disabled}
          />
        </Pressable>

        <View style={styles.valueWrap}>
          <Text style={styles.value} accessibilityLabel={`${label} : ${value}`}>
            {value}
          </Text>
        </View>

        <Pressable
          onPress={press(1)}
          onLongPress={longPress(1)}
          delayLongPress={LONG_PRESS_MS}
          disabled={!canIncrement}
          accessibilityRole="button"
          accessibilityLabel={`Ajouter ${step}`}
          accessibilityHint={`Appui long : ajouter ${step * LONG_PRESS_FACTOR}`}
          style={({ pressed }) => [
            styles.pad,
            styles.padPrimary,
            pressed && canIncrement && styles.padPressed,
            !canIncrement && styles.padDisabled,
          ]}
        >
          <Plus
            size={32}
            color={canIncrement ? tokens.colors.action.accumulate.fg : tokens.colors.field.disabled}
          />
        </Pressable>
      </View>

      <Text style={styles.helper}>
        {helperText ?? `Appui long : ${step * LONG_PRESS_FACTOR} d'un coup`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.spacing[3], alignItems: 'center' },
  label: {
    ...tokens.typography.label,
    color: tokens.colors.field.textMuted,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[4],
  },
  pad: {
    width: tokens.touch.counterPrimary,
    height: tokens.touch.counterPrimary,
    borderRadius: tokens.radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: tokens.layout.borderWidth,
  },
  // Green accumulates: the direction reserves it for the repeated, reversible action.
  padPrimary: {
    backgroundColor: tokens.colors.action.accumulate.bg,
    borderColor: tokens.colors.action.accumulate.border,
  },
  padSecondary: {
    backgroundColor: tokens.colors.action.secondary.bg,
    borderColor: tokens.colors.action.secondary.border,
  },
  padPressed: { opacity: 0.75 },
  // Kept in the layout, only muted: a pad that vanishes moves its neighbour under the thumb.
  padDisabled: {
    backgroundColor: tokens.colors.neutral[100],
    borderColor: tokens.colors.field.ruleSubtle,
  },
  valueWrap: { minWidth: 120, alignItems: 'center' },
  value: {
    ...tokens.typography.numeric,
    color: tokens.colors.field.text,
  },
  helper: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
  },
});
