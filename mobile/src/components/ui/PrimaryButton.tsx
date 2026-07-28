/**
 * The one button primitive for standard (non-counter) screens. Sizes and roles
 * come straight from the brief:
 *   size:  "cta" 72dp (giant "Enregistrer") · "primary" 56dp · "secondary" 48dp
 *   role:  "commit" orange · "accumulate" green · "danger" red · "secondary" outline
 *
 * Orange commit uses `earth` text (the only legible pair on accent-400 — design
 * direction §4). Full-width by default; a leading glyph is optional.
 */
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { tokens } from '@/theme';

type Role = 'commit' | 'accumulate' | 'danger' | 'secondary';
type Size = 'cta' | 'primary' | 'secondary';

const HEIGHT: Record<Size, number> = {
  cta: tokens.touch.cta,
  primary: tokens.touch.primaryButton,
  secondary: tokens.touch.secondary,
};

function palette(role: Role): { bg: string; fg: string; border: string } {
  switch (role) {
    case 'commit':
      return tokens.colors.action.commit;
    case 'accumulate':
      return tokens.colors.action.accumulate;
    case 'danger':
      return tokens.colors.action.danger;
    case 'secondary':
      return tokens.colors.action.secondary;
  }
}

export function PrimaryButton({
  label,
  onPress,
  role = 'commit',
  size = 'primary',
  icon,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  role?: Role;
  size?: Size;
  icon?: LucideIcon;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const Icon = icon;
  const p = palette(role);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.btn,
        { minHeight: HEIGHT[size], backgroundColor: p.bg, borderColor: p.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.inner}>
        {Icon ? <Icon size={size === 'cta' ? 24 : 20} color={p.fg} /> : null}
        <Text style={[styles.label, { color: p.fg }, size === 'cta' && styles.labelCta]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[4],
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.45 },
  label: { ...tokens.typography.button },
  labelCta: { fontSize: 20, lineHeight: 24 },
});
