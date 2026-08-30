/**
 * Withdrawal period notice.
 *
 * **A warning, never a block.** The backend is explicit about it — "the withdrawal is exposed
 * but NEVER enforced — V1 = warning only, farmer responsible" — and no endpoint refuses a sale
 * during a delay. So this box informs and stops there: turning it into a guard would be the app
 * deciding something the platform deliberately left to the farmer.
 *
 * It states the earliest sale date rather than only the number of days: "vendable dès le 10/09"
 * is a date one can plan around, "9 jours restants" is a subtraction one has to do first.
 */
import { StyleSheet, Text, View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { fontFamily, tokens } from '@/theme';
import { daysBetween, isoToday } from '@/lib/health';

function frenchDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export type WithdrawalNoticeProps = {
  withdrawalEndDateMeat: string | null;
  withdrawalEndDateEggs: string | null;
  /** Compact form for a row inside a list; the full form carries the explanatory footer. */
  compact?: boolean;
};

export function WithdrawalNotice({
  withdrawalEndDateMeat,
  withdrawalEndDateEggs,
  compact = false,
}: WithdrawalNoticeProps) {
  const today = isoToday();

  const rows = [
    { label: 'Viande', date: withdrawalEndDateMeat },
    { label: 'Œufs', date: withdrawalEndDateEggs },
  ].filter((r): r is { label: string; date: string } => r.date !== null);

  if (rows.length === 0) {
    if (compact) return null;
    return (
      <View style={styles.box}>
        <Text style={styles.empty}>
          Aucun délai d&apos;attente déclaré pour ce traitement dans la bibliothèque.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <TriangleAlert size={18} color={tokens.colors.warningDark} />
        <Text style={styles.title}>Délai d&apos;attente</Text>
      </View>

      {rows.map((row) => {
        const remaining = daysBetween(today, row.date);
        const cleared = remaining <= 0;
        return (
          <View key={row.label} style={styles.row}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={[styles.rowValue, cleared && styles.rowValueCleared]}>
              {cleared ? 'Terminé' : `Vendable dès le ${frenchDate(row.date)}`}
            </Text>
          </View>
        );
      })}

      {!compact && (
        <Text style={styles.footer}>
          Aucune vente n&apos;est recommandée avant ces dates. L&apos;application ne les bloque
          pas : la décision vous appartient.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: tokens.colors.warningLight,
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.warning,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing[3],
    gap: tokens.spacing[2],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  title: {
    ...tokens.typography.label,
    color: tokens.colors.warningDark,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  rowValue: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.warningDark,
    fontFamily: fontFamily.sansSemiBold,
  },
  rowValueCleared: { color: tokens.colors.field.textMuted },
  footer: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
    lineHeight: 18,
  },
  empty: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
});
