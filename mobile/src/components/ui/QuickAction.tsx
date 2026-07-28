/**
 * Quick-action tile — the big field affordance on the dashboard (brief · Page 1
 * Row 3): a ≥ 96dp coloured tile with a filled glyph and a short label, sized
 * for a gloved thumb. One tap opens the matching entry screen.
 *
 * Colour is carried as a solid tint wash so the target is unmistakable under
 * direct sun (brief · "zone d'action très visible").
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { tokens } from '@/theme';

export function QuickAction({
  label,
  icon: Icon,
  tint,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: LucideIcon;
  tint: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.tile, { borderColor: withAlpha(tint, 0.35) }, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={[styles.disc, { backgroundColor: withAlpha(tint, 0.14) }]}>
        <Icon size={26} color={tint} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: tokens.touch.quickAction,
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    paddingVertical: tokens.spacing[3],
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  disc: {
    width: 48,
    height: 48,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...tokens.typography.bodyMd,
    fontWeight: '600',
    color: tokens.colors.field.text,
  },
});
