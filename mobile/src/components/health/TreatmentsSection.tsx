/**
 * Treatments administered on a lot, and the withdrawal delays they opened.
 *
 * A treatment matters to a farmer for one reason above all the others: it decides when the
 * meat or the eggs may be sold. So a running delay is the first thing on the row, and the
 * notice sits under it rather than behind a tap.
 *
 * Deleting is OWNER-only server-side — a treatment record is traceability, not a note — so the
 * button is absent for anyone else rather than present and answered with a 403.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pill, Trash2 } from 'lucide-react-native';
import { fontFamily, tokens } from '@/theme';
import { humanizeKey, routeLabel, withdrawalDaysRemaining } from '@/lib/health';
import { WithdrawalNotice } from './WithdrawalNotice';
import type { ExecutedTreatment } from '@/types';

function frenchDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export type TreatmentsSectionProps = {
  treatments: ExecutedTreatment[];
  /** OWNER only — the server refuses anyone else. */
  canDelete: boolean;
  onDelete: (treatment: ExecutedTreatment) => void;
};

export function TreatmentsSection({ treatments, canDelete, onDelete }: TreatmentsSectionProps) {
  if (treatments.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Pill size={18} color={tokens.colors.field.text} />
          <Text style={styles.title}>Traitements</Text>
        </View>
        <Text style={styles.muted}>Aucun traitement enregistré sur ce lot.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pill size={18} color={tokens.colors.field.text} />
        <Text style={styles.title}>Traitements</Text>
      </View>

      {treatments.map((treatment) => {
        const remaining = withdrawalDaysRemaining(treatment);
        return (
          <View key={treatment.id} style={styles.row}>
            <View style={styles.rowHead}>
              <View style={styles.rowText}>
                <Text style={styles.name}>{humanizeKey(treatment.treatmentKey)}</Text>
                <Text style={styles.muted}>
                  {`Du ${frenchDate(treatment.startDate)} au ${frenchDate(treatment.endDate)} · ${
                    treatment.doseAmount
                  } ${treatment.doseUnit} · ${routeLabel(treatment.route)}`}
                </Text>
              </View>
              {canDelete && (
                <Pressable
                  onPress={() => onDelete(treatment)}
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer le traitement ${humanizeKey(
                    treatment.treatmentKey,
                  )}`}
                  hitSlop={8}
                  style={styles.delete}
                >
                  <Trash2 size={18} color={tokens.colors.error} />
                </Pressable>
              )}
            </View>

            {remaining !== null && (
              <Text style={styles.remaining}>
                {`Délai en cours · ${remaining} jour${remaining > 1 ? 's' : ''} restant${
                  remaining > 1 ? 's' : ''
                }`}
              </Text>
            )}

            {remaining !== null && (
              <WithdrawalNotice
                withdrawalEndDateMeat={treatment.withdrawalEndDateMeat}
                withdrawalEndDateEggs={treatment.withdrawalEndDateEggs}
                compact
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.field.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.field.ruleSubtle,
    padding: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  title: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  muted: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  row: { gap: tokens.spacing[2], paddingTop: tokens.spacing[2] },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing[3] },
  rowText: { flex: 1, gap: 2 },
  name: { ...tokens.typography.bodyLg, color: tokens.colors.field.text },
  remaining: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.warningDark,
    fontFamily: fontFamily.sansSemiBold,
  },
  delete: { minWidth: tokens.touch.min, minHeight: tokens.touch.min, alignItems: 'flex-end' },
});
