/**
 * Vet visits recorded on a lot.
 *
 * A visit with a cost books a farm expense server-side, and deleting it reverses that expense —
 * so the delete confirmation says so. A farmer who removes a visit to tidy a list should not
 * discover a week later that their accounts moved.
 *
 * A scheduled follow-up is the only thing here that is about the future, so it is the only thing
 * pulled out of the row and given a colour.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarClock, Stethoscope, Trash2 } from 'lucide-react-native';
import { fontFamily, tokens } from '@/theme';
import { daysBetween, isoToday } from '@/lib/health';
import { formatNumber } from '@/lib/format';
import type { Veterinarian, VetVisit } from '@/types';

function frenchDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export type VetVisitsSectionProps = {
  visits: VetVisit[];
  veterinarians: Veterinarian[];
  canDelete: boolean;
  onDelete: (visit: VetVisit) => void;
};

export function VetVisitsSection({
  visits,
  veterinarians,
  canDelete,
  onDelete,
}: VetVisitsSectionProps) {
  const today = isoToday();

  const vetName = (id: number | null): string => {
    if (id === null) return 'Visite sans vétérinaire nommé';
    return veterinarians.find((v) => v.id === id)?.fullName ?? 'Vétérinaire retiré';
  };

  if (visits.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Stethoscope size={18} color={tokens.colors.field.text} />
          <Text style={styles.title}>Visites vétérinaires</Text>
        </View>
        <Text style={styles.muted}>Aucune visite enregistrée sur ce lot.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Stethoscope size={18} color={tokens.colors.field.text} />
        <Text style={styles.title}>Visites vétérinaires</Text>
      </View>

      {visits.map((visit) => {
        const daysUntilFollowUp =
          visit.followUpNeeded && visit.followUpDate
            ? daysBetween(today, visit.followUpDate)
            : null;

        return (
          <View key={visit.id} style={styles.row}>
            <View style={styles.rowHead}>
              <View style={styles.rowText}>
                <Text style={styles.name}>{visit.reason}</Text>
                <Text style={styles.muted}>
                  {`${frenchDate(visit.visitDate)} · ${vetName(visit.veterinarianId)}${
                    visit.costXof ? ` · ${formatNumber(visit.costXof)} F` : ''
                  }`}
                </Text>
              </View>
              {canDelete && (
                <Pressable
                  onPress={() => onDelete(visit)}
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer la visite du ${frenchDate(visit.visitDate)}`}
                  hitSlop={8}
                  style={styles.delete}
                >
                  <Trash2 size={18} color={tokens.colors.error} />
                </Pressable>
              )}
            </View>

            {visit.diagnosis ? <Text style={styles.body}>{visit.diagnosis}</Text> : null}

            {daysUntilFollowUp !== null && visit.followUpDate && (
              <View style={styles.followUp}>
                <CalendarClock size={16} color={tokens.colors.vet} />
                <Text style={styles.followUpText}>
                  {daysUntilFollowUp >= 0
                    ? `Suivi prévu le ${frenchDate(visit.followUpDate)}`
                    : `Suivi dépassé depuis le ${frenchDate(visit.followUpDate)}`}
                </Text>
              </View>
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
  body: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  row: { gap: tokens.spacing[2], paddingTop: tokens.spacing[2] },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing[3] },
  rowText: { flex: 1, gap: 2 },
  name: { ...tokens.typography.bodyLg, color: tokens.colors.field.text },
  followUp: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  followUpText: {
    ...tokens.typography.bodySm,
    color: tokens.colors.vet,
    fontFamily: fontFamily.sansSemiBold,
  },
  delete: { minWidth: tokens.touch.min, minHeight: tokens.touch.min, alignItems: 'flex-end' },
});
