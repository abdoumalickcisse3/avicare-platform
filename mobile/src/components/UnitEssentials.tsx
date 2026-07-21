/**
 * Batch essentials — decision M2 (task 9 brief): the head count is the hero
 * number, shown before any entry action, because the farmer is about to
 * decrement it and must not work blind.
 *
 * Pure presentational component — no hooks, no data fetching. The screen
 * (`(field)/lots/[unitId]/index.tsx`) owns the cache lookup, the age/breed
 * resolution and the offline `stale` flag; this component only renders what
 * it's given, which keeps it trivially testable.
 */
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/theme';

export interface UnitEssentialsData {
  currentCount: number;
  ageDays: number;
  breedName: string;
}

export interface UnitEssentialsProps {
  unit: UnitEssentialsData;
  /**
   * True when `unit` comes from the RTK Query cache after a failed refetch
   * (offline). Showing cached data without saying it may be stale is a UI
   * lie (design direction §1) — this renders a visible notice, never a
   * colour-only cue.
   */
  stale?: boolean;
}

export function UnitEssentials({ unit, stale = false }: UnitEssentialsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Effectif actuel</Text>
      <Text style={styles.count}>{unit.currentCount}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>{unit.ageDays} jours</Text>
        <Text style={styles.metaSeparator}>·</Text>
        <Text style={styles.meta}>{unit.breedName}</Text>
      </View>

      {stale ? (
        <View style={styles.staleBadge}>
          <Text style={styles.staleIcon}>!</Text>
          <Text style={styles.staleText}>
            Dernière mise à jour hors ligne — donnée en cache
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[6],
  },
  label: {
    ...tokens.typography.label,
    color: tokens.colors.field.textMuted,
  },
  count: {
    ...tokens.typography.numeric,
    color: tokens.colors.field.text,
    marginTop: tokens.spacing[2],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: tokens.spacing[3],
    gap: tokens.spacing[2],
  },
  meta: {
    ...tokens.typography.bodyLg,
    color: tokens.colors.field.textMuted,
  },
  metaSeparator: {
    ...tokens.typography.bodyLg,
    color: tokens.colors.field.textMuted,
  },
  staleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.warningLight,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
    marginTop: tokens.spacing[4],
    gap: tokens.spacing[2],
  },
  staleIcon: {
    ...tokens.typography.label,
    color: tokens.colors.warningDark,
  },
  staleText: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.warningDark,
  },
});
