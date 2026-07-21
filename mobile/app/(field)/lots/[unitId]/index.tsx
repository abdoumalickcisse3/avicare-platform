/**
 * Batch detail — "essentials" screen (task 9 brief, decision M2): current
 * head count, age and breed, plus a launcher to the four entry screens
 * (tasks 10-13, not built yet — routes exist here but the target screens
 * don't, which is expected at this point in the sprint).
 *
 * Offline behaviour mirrors task 8's batch list: the unit is looked up in
 * the already-cached `useListProductionUnitsQuery` result rather than
 * fetched again, so the essentials stay available offline. `stale` is
 * derived the same way — a failed refetch on top of existing cached data.
 *
 * "Saisies du jour" (today's-entries recap, also mentioned in the brief) is
 * deliberately deferred: it depends on the entry screens' local queue
 * (tasks 10-13) and there's no backend endpoint that returns "today's
 * entries for this unit" in one call. A labelled placeholder stands in its
 * place instead of a half-wired version.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { tokens } from '@/theme';
import { UnitEssentials } from '@/components/UnitEssentials';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { useListBreedsQuery } from '@/store/api/breedsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';

const MS_PER_DAY = 86_400_000;

/** Plain Date math per the brief — avoids adding `date-fns` to mobile for one computation. */
function ageInDays(startDate: string | null | undefined): number | null {
  if (!startDate) return null;
  const start = Date.parse(startDate);
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.floor((Date.now() - start) / MS_PER_DAY));
}

interface ActionDef {
  key: string;
  label: string;
  /** Segment appended under `/(field)/lots/{unitId}/`. */
  segment: string;
}

const JOURNALIER: ActionDef = { key: 'journalier', label: 'Suivi journalier', segment: 'journalier' };
const PESEE: ActionDef = { key: 'pesee', label: 'Pesée', segment: 'pesee' };
const MORTALITE: ActionDef = { key: 'mortalite', label: 'Mortalité', segment: 'mortalite' };
const OEUFS: ActionDef = { key: 'oeufs', label: "Collecte d'œufs", segment: 'oeufs' };

/**
 * D17 (decision brief): gate entry actions by breed type. Broiler = growth
 * tracking (journalier + pesée) + mortalité. Layer = egg collection +
 * mortalité. Unknown/missing breed type degrades permissively — show
 * everything rather than hide an action the farmer might need.
 */
function actionsForBreedType(breedType: string | null): ActionDef[] {
  if (breedType === 'broiler') return [JOURNALIER, PESEE, MORTALITE];
  if (breedType === 'layer') return [OEUFS, MORTALITE];
  return [MORTALITE, JOURNALIER, PESEE, OEUFS];
}

export default function BatchDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId: string }>();
  const rawUnitId = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const unitId = rawUnitId ? Number(rawUnitId) : NaN;

  const selectedFarmId = useSelector(selectSelectedFarmId);

  // Hooks run unconditionally (rules of hooks) — the "no farm selected"
  // redirect below happens after every hook has been called, same as
  // `(field)/lots/index.tsx`. `skipToken` keeps the queries inert when
  // there's nothing valid to fetch yet.
  const {
    data: units,
    isLoading: unitsLoading,
    isError: unitsError,
  } = useListProductionUnitsQuery(selectedFarmId ?? skipToken);

  const unit = units?.find((u) => u.id === unitId);

  const { data: breeds } = useListBreedsQuery(unit ? unit.species : skipToken);
  const breed = unit && unit.breedId !== null ? breeds?.find((b) => b.id === unit.breedId) : undefined;
  const breedName = breed?.name ?? 'Race inconnue';
  const breedType = breed?.type ?? null;

  // No farm picked yet (e.g. a cold deep link) — send back to the selector
  // rather than rendering against an invalid farmId.
  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  // Same offline signal as the batch list: a refetch failed, but the last
  // successful payload (containing this unit) is still in cache.
  const stale = unitsError && units !== undefined;

  const actions = actionsForBreedType(breedType);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{unit ? unit.name : 'Lot'}</Text>
        {unit ? (
          <Text style={styles.subtitle}>
            {unit.species} · {unit.status}
          </Text>
        ) : null}
      </View>

      <View style={styles.rule} />

      {unitsLoading ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>Chargement…</Text>
        </View>
      ) : !unit ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>
            {unitsError ? 'Lot indisponible hors ligne' : 'Lot introuvable'}
          </Text>
        </View>
      ) : (
        <>
          <UnitEssentials
            unit={{
              currentCount: unit.currentCount,
              ageDays: ageInDays(unit.startDate) ?? 0,
              breedName,
            }}
            stale={stale}
          />

          <View style={styles.rule} />

          <View style={styles.todaySection}>
            <Text style={styles.sectionLabel}>Saisies du jour</Text>
            <Text style={styles.todayPlaceholder}>Disponible après la première saisie</Text>
          </View>

          <View style={styles.launcher}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={styles.actionButton}
                onPress={() => router.push(`/(field)/lots/${unitId}/${action.segment}`)}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.field.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.layout.screenPadding,
  },
  header: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[6],
    paddingBottom: tokens.spacing[4],
  },
  title: {
    ...tokens.typography.displayMd,
    color: tokens.colors.field.text,
  },
  subtitle: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.textMuted,
    marginTop: tokens.spacing[1],
  },
  empty: {
    ...tokens.typography.headingMd,
    color: tokens.colors.field.textMuted,
  },
  rule: {
    height: tokens.layout.ruleWidth,
    backgroundColor: tokens.colors.field.rule,
  },
  todaySection: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[5],
  },
  sectionLabel: {
    ...tokens.typography.label,
    color: tokens.colors.field.textMuted,
  },
  todayPlaceholder: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.textMuted,
    marginTop: tokens.spacing[2],
  },
  // Stacked toward the lower part of the screen — the thumb zone (design
  // direction §2.3) — via `marginTop: 'auto'` on the section that pushes
  // it to the bottom of the flex-column container.
  launcher: {
    marginTop: 'auto',
    paddingHorizontal: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[6],
    gap: tokens.spacing[3],
  },
  actionButton: {
    minHeight: tokens.touch.button,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.secondary.border,
    backgroundColor: tokens.colors.action.secondary.bg,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[4],
  },
  actionLabel: {
    ...tokens.typography.button,
    color: tokens.colors.action.secondary.fg,
  },
});
