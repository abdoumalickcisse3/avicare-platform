/**
 * The built-in numeric keypad of design direction §2.4, finally built.
 *
 * Why not the system keyboard, which is free and already there:
 *
 * - It takes half the screen, so the value being typed is pushed out of sight exactly when
 *   it needs checking.
 * - Its layout moves between phones and between Android skins, so the muscle memory a
 *   farmer builds on one device does not transfer to the next.
 * - Its keys sit under the suggestion strip, where a gloved thumb hits the wrong row.
 *
 * A built-in pad keeps its keys in the same place forever, sits inside the thumb zone, and
 * leaves the value visible above it. `touch.keypadKey` (64dp) has described it in the tokens
 * since the field design was written.
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Delete } from 'lucide-react-native';
import { tokens } from '@/theme';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export type NumericKeypadProps = {
  value: string;
  onChange: (next: string) => void;
  /** Digits only, decimal separator excluded. Omitted means unbounded. */
  maxLength?: number;
  /** Show the decimal key. A weight allows one; a headcount does not. */
  allowDecimal?: boolean;
};

export function NumericKeypad({
  value,
  onChange,
  maxLength,
  allowDecimal = false,
}: NumericKeypadProps) {
  const digitCount = useCallback((text: string) => text.replace(/\D/g, '').length, []);

  const append = (key: string) => () => {
    if (key === ',') {
      // One separator, and never as the first character: ",5" is not a number a farmer means.
      if (value.includes(',') || value.length === 0) return;
    } else if (maxLength !== undefined && digitCount(value) >= maxLength) {
      // Silently, on purpose: an error message for "you have typed enough" is noise.
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(value + key);
  };

  const backspace = () => {
    if (value.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(value.slice(0, -1));
  };

  const clear = () => {
    if (value.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChange('');
  };

  const key = (label: string, onPress: () => void, accessibilityLabel?: string) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
    >
      <Text style={styles.keyLabel}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.display}>
        <Text style={styles.value} accessibilityLabel={`Valeur saisie : ${value || '0'}`}>
          {value || '0'}
        </Text>
      </View>

      <View style={styles.grid}>
        {DIGITS.map((digit) => key(digit, append(digit)))}

        {/* Absent rather than disabled when decimals are not allowed: a dead key invites a
            press, and a press that does nothing reads as a broken screen. */}
        {allowDecimal ? (
          key(',', append(','), 'Virgule')
        ) : (
          <View style={styles.keySpacer} />
        )}

        {key('0', append('0'))}

        <Pressable
          onPress={backspace}
          onLongPress={clear}
          delayLongPress={400}
          accessibilityRole="button"
          accessibilityLabel="Effacer"
          accessibilityHint="Appui long : tout effacer"
          style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
        >
          <Delete size={26} color={tokens.colors.field.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.spacing[4] },
  display: {
    alignItems: 'center',
    paddingVertical: tokens.spacing[2],
  },
  value: {
    ...tokens.typography.numeric,
    color: tokens.colors.field.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: tokens.touch.gap,
  },
  key: {
    width: tokens.touch.keypadKey,
    height: tokens.touch.keypadKey,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.action.secondary.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.secondary.border,
  },
  keyPressed: { opacity: 0.7 },
  // Holds the slot so the grid keeps its three columns and "0" never shifts under the thumb.
  keySpacer: { width: tokens.touch.keypadKey, height: tokens.touch.keypadKey },
  keyLabel: {
    ...tokens.typography.numericSm,
    color: tokens.colors.field.text,
  },
});
