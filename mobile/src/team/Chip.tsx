/** A full-size toggle chip — `touch.button` tall, so it is a target and not a checkbox. */
import { Pressable, StyleSheet, Text } from 'react-native';
import { fontFamily, tokens } from '@/theme';

export function Chip({
  label,
  active,
  disabled,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, active && styles.on, disabled && styles.disabled]}
    >
      <Text style={[styles.text, active && styles.textOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: tokens.touch.button,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radii.full,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
  },
  on: {
    backgroundColor: tokens.colors.action.accumulate.bg,
    borderColor: tokens.colors.action.accumulate.border,
  },
  disabled: { opacity: 0.45 },
  text: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  textOn: { color: tokens.colors.action.accumulate.fg, fontFamily: fontFamily.sansSemiBold },
});
