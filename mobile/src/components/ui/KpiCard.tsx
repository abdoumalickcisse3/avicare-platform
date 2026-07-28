/**
 * Dashboard KPI card — mobile twin of the web `StatCard`: a tinted icon disc,
 * a big value (mono) and a label, with an optional alert state. Kept dense so a
 * 2×2 grid reads at a glance in the field (brief · Page 1 Row 2).
 *
 * Icon is a glyph string (emoji today; swappable for a vector icon set later)
 * rendered inside the disc — the component stays icon-library-agnostic.
 */
import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { tokens } from '@/theme';

export function KpiCard({
  label,
  value,
  icon: Icon,
  tint,
  alert = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  /** A colour from `tokens.colors` — disc tint / alert accent. */
  tint: string;
  alert?: boolean;
}) {
  const accent = alert ? tokens.colors.warning : tint;
  return (
    <View style={[styles.card, alert && styles.cardAlert]}>
      <View style={styles.top}>
        <View style={[styles.disc, { backgroundColor: withAlpha(accent, 0.14) }]}>
          <Icon size={20} color={accent} />
        </View>
        {alert && <View style={[styles.dot, { backgroundColor: tokens.colors.warning }]} />}
      </View>
      <Text style={[styles.value, alert && { color: tokens.colors.warningDark }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

/** Hex + opacity → rgba (tokens are opaque hex; discs need a soft wash). */
function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.xl,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    padding: tokens.spacing[4],
    gap: tokens.spacing[2],
    shadowColor: '#1C1917',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardAlert: {
    borderColor: tokens.colors.warningLight,
    backgroundColor: tokens.colors.warningLight,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  disc: {
    width: 40,
    height: 40,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  value: {
    ...tokens.typography.numericSm,
    fontSize: 26,
    lineHeight: 30,
    color: tokens.colors.field.text,
  },
  label: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
  },
});
