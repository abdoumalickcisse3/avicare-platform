/**
 * Egg collection entry ("Collecte d'œufs") — task 13. DIFFERENT clientRef
 * semantics from mortality/weighing (tasks 11/12): the backend upserts a
 * collection on the natural key (unit, date, time-slot), so replaying the
 * exact same request is already safe server-side and needs no `client_ref`
 * in the payload at all.
 *
 * The local queue, however, still needs a stable identity for this
 * (unit, date, slot) so that submitting the same slot twice in the app
 * (a farmer correcting a count before the first submission even left the
 * device) REPLACES the queued draft instead of stacking a second one that
 * would double-send. `queue.enqueue` throws on a duplicate `client_ref`
 * (UNIQUE column), so this screen derives a deterministic ref from the
 * natural key, and — before enqueueing — removes any existing queue row
 * sharing that exact ref (`queue.markDone`, regardless of its status) so
 * the insert always succeeds and only the latest draft survives.
 *
 * `timeslotKey` is never hardcoded (doc 00 "Règle d'or n°0"): it comes from
 * the farm's configured time-slots, fetched via `layerConfigApi`. Offline
 * with no cached config, submission is disabled with a clear message rather
 * than falling back to a guessed slot.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { tokens } from '@/theme';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { useListTimeslotsQuery, type LayerConfigEntry } from '@/store/api/layerConfigApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { enqueueFieldMutation } from '@/field/enqueueMutation';
import { queue } from '@/sync';

const MS_PER_DAY = 86_400_000;
const TRAY_SIZE = 30;

/** Duplicated on purpose — see journalier.tsx's identical helper for why. */
function ageInDays(startDate: string | null | undefined): number | null {
  if (!startDate) return null;
  const start = Date.parse(startDate);
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.floor((Date.now() - start) / MS_PER_DAY));
}

/** Today's date as `YYYY-MM-DD` — see journalier.tsx's identical helper for why local, not UTC. */
function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timeslotLabel(entry: LayerConfigEntry): string {
  return typeof entry.value.label === 'string' ? entry.value.label : entry.key;
}

function timeslotOrder(entry: LayerConfigEntry): number {
  return typeof entry.value.order === 'number' ? entry.value.order : 0;
}

/** Deterministic key for the local queue's upsert-per-slot behaviour. */
function slotClientRef(unitId: number, collectionDate: string, timeslotKey: string): string {
  return `egg-${unitId}-${collectionDate}-${timeslotKey}`;
}

export default function EggCollectionEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId: string }>();
  const rawUnitId = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const unitId = rawUnitId ? Number(rawUnitId) : NaN;

  const selectedFarmId = useSelector(selectSelectedFarmId);

  const { data: units } = useListProductionUnitsQuery(selectedFarmId ?? skipToken);
  const unit = units?.find((u) => u.id === unitId);

  const {
    data: timeslots,
    isLoading: timeslotsLoading,
    isError: timeslotsError,
  } = useListTimeslotsQuery(selectedFarmId ?? skipToken);

  const sortedTimeslots = [...(timeslots ?? [])].sort((a, b) => timeslotOrder(a) - timeslotOrder(b));

  const [selectedTimeslotKey, setSelectedTimeslotKey] = useState<string | null>(null);
  const [totalEggs, setTotalEggs] = useState(0);
  const [brokenEggs, setBrokenEggs] = useState(0);

  // Default to the first configured slot once the config loads, but only if
  // the farmer hasn't already picked one — never override a manual choice.
  useEffect(() => {
    if (selectedTimeslotKey === null && sortedTimeslots.length > 0) {
      setSelectedTimeslotKey(sortedTimeslots[0]?.key ?? null);
    }
  }, [selectedTimeslotKey, sortedTimeslots]);

  // Hooks above run unconditionally (rules of hooks); the redirect below
  // only happens once every hook ran, same as the other field screens.
  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  const noTimeslotsAvailable = !timeslotsLoading && sortedTimeslots.length === 0;
  const canSubmit = selectedTimeslotKey !== null && !Number.isNaN(unitId);

  function handleSubmit(): void {
    if (selectedFarmId === null || Number.isNaN(unitId) || selectedTimeslotKey === null) return;

    const collectionDate = todayIsoDate();
    const ref = slotClientRef(unitId, collectionDate, selectedTimeslotKey);

    // Upsert-per-slot, locally: any existing queue row for this exact
    // (unit, date, slot) is a stale draft of THIS submission, not a
    // separate one — remove it (whatever its status) so the enqueue below
    // never collides with the UNIQUE client_ref constraint, and only the
    // latest values are ever sent.
    for (const pending of queue.listAll()) {
      if (pending.clientRef === ref) {
        queue.markDone(pending.id);
      }
    }

    enqueueFieldMutation({
      farmId: selectedFarmId,
      kind: 'EGG_COLLECTION',
      endpoint: `/api/v1/farms/${selectedFarmId}/egg-production/collections`,
      payload: {
        unitId,
        collectionDate,
        timeslotKey: selectedTimeslotKey,
        totalEggs,
        brokenEggs,
      },
      clientRef: ref,
    });

    setTotalEggs(0);
    setBrokenEggs(0);
    router.back();
  }

  const age = ageInDays(unit?.startDate);
  const headerLabel = unit ? `Lot ${unit.name}${age !== null ? ` · J${age}` : ''}` : 'Lot';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={{
            top: tokens.spacing[2],
            bottom: tokens.spacing[2],
            left: tokens.spacing[2],
            right: tokens.spacing[2],
          }}
        >
          <Text style={styles.backLabel}>{`← ${headerLabel}`}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Collecte d&apos;œufs</Text>
      </View>

      <View style={styles.rule} />

      <View style={styles.content}>
        <View style={styles.timeslotBlock}>
          <Text style={styles.sectionLabel}>CRÉNEAU</Text>
          {noTimeslotsAvailable || timeslotsError ? (
            <Text style={styles.unavailable}>Créneaux indisponibles hors ligne</Text>
          ) : (
            <View style={styles.timeslotRow}>
              {sortedTimeslots.map((entry) => {
                const selected = entry.key === selectedTimeslotKey;
                return (
                  <TouchableOpacity
                    key={entry.key}
                    style={[styles.timeslotChip, selected && styles.timeslotChipSelected]}
                    onPress={() => setSelectedTimeslotKey(entry.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Créneau ${timeslotLabel(entry)}`}
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.timeslotChipLabel, selected && styles.timeslotChipLabelSelected]}>
                      {timeslotLabel(entry)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.rule} />

        <View style={styles.counterBlock}>
          <Text style={styles.counterLabel}>ŒUFS COLLECTÉS</Text>
          <Text style={styles.counterValue}>{totalEggs}</Text>

          <View style={styles.counterControls}>
            <TouchableOpacity
              style={[styles.stepButton, styles.decrementButton, totalEggs === 0 && styles.stepButtonDisabled]}
              onPress={() => setTotalEggs((c) => Math.max(0, c - 1))}
              disabled={totalEggs === 0}
              accessibilityRole="button"
              accessibilityLabel="Retirer un œuf"
            >
              <Text style={styles.decrementLabel}>−1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepButton, styles.smallIncrementButton]}
              onPress={() => setTotalEggs((c) => c + 1)}
              accessibilityRole="button"
              accessibilityLabel="Ajouter un œuf"
            >
              <Text style={styles.smallIncrementLabel}>+1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepButton, styles.incrementButton]}
              onPress={() => setTotalEggs((c) => c + TRAY_SIZE)}
              accessibilityRole="button"
              accessibilityLabel={`Ajouter un plateau (${TRAY_SIZE} œufs)`}
            >
              <Text style={styles.incrementLabel}>{`+${TRAY_SIZE}`}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.rule} />

        <View style={styles.brokenBlock}>
          <Text style={styles.sectionLabel}>DONT CASSÉS</Text>
          <Text style={styles.brokenValue}>{brokenEggs}</Text>
          <View style={styles.brokenControls}>
            <TouchableOpacity
              style={[styles.readingStepButton, brokenEggs === 0 && styles.stepButtonDisabled]}
              onPress={() => setBrokenEggs((c) => Math.max(0, c - 1))}
              disabled={brokenEggs === 0}
              accessibilityRole="button"
              accessibilityLabel="Retirer un œuf cassé"
            >
              <Text style={styles.readingStepLabel}>−1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.readingStepButton, styles.readingStepButtonAccent]}
              onPress={() => setBrokenEggs((c) => c + 1)}
              accessibilityRole="button"
              accessibilityLabel="Ajouter un œuf cassé"
            >
              <Text style={styles.readingStepLabelAccent}>+1</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.validateButton, !canSubmit && styles.stepButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer la collecte"
        >
          <Text style={styles.validateLabel}>Enregistrer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.field.background,
  },
  header: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[4],
    paddingBottom: tokens.spacing[4],
  },
  backLabel: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.textMuted,
  },
  title: {
    ...tokens.typography.displayMd,
    color: tokens.colors.field.text,
    marginTop: tokens.spacing[1],
  },
  rule: {
    height: tokens.layout.ruleWidth,
    backgroundColor: tokens.colors.field.rule,
  },
  content: {
    flex: 1,
  },
  timeslotBlock: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[4],
  },
  sectionLabel: {
    ...tokens.typography.label,
    color: tokens.colors.field.textMuted,
  },
  unavailable: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.textMuted,
    marginTop: tokens.spacing[2],
  },
  timeslotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing[2],
    marginTop: tokens.spacing[2],
  },
  timeslotChip: {
    minHeight: tokens.touch.button,
    paddingHorizontal: tokens.spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.md,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.secondary.border,
    backgroundColor: tokens.colors.action.secondary.bg,
  },
  timeslotChipSelected: {
    backgroundColor: tokens.colors.action.accumulate.bg,
    borderColor: tokens.colors.action.accumulate.border,
  },
  timeslotChipLabel: {
    ...tokens.typography.button,
    color: tokens.colors.action.secondary.fg,
  },
  timeslotChipLabelSelected: {
    color: tokens.colors.action.accumulate.fg,
  },
  counterBlock: {
    alignItems: 'center',
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[6],
  },
  counterLabel: {
    ...tokens.typography.label,
    color: tokens.colors.field.textMuted,
  },
  counterValue: {
    ...tokens.typography.numeric,
    color: tokens.colors.field.text,
    marginTop: tokens.spacing[2],
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing[8],
    gap: tokens.spacing[4],
  },
  stepButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.full,
    borderWidth: tokens.layout.borderWidth,
  },
  stepButtonDisabled: {
    opacity: 0.4,
  },
  decrementButton: {
    width: tokens.touch.counterSecondary,
    height: tokens.touch.counterSecondary,
    backgroundColor: tokens.colors.action.secondary.bg,
    borderColor: tokens.colors.action.secondary.border,
  },
  decrementLabel: {
    ...tokens.typography.headingMd,
    color: tokens.colors.action.secondary.fg,
  },
  smallIncrementButton: {
    width: tokens.touch.counterSecondary,
    height: tokens.touch.counterSecondary,
    backgroundColor: tokens.colors.action.accumulate.bg,
    borderColor: tokens.colors.action.accumulate.border,
  },
  smallIncrementLabel: {
    ...tokens.typography.headingMd,
    color: tokens.colors.action.accumulate.fg,
  },
  incrementButton: {
    width: tokens.touch.counterPrimary,
    height: tokens.touch.counterPrimary,
    backgroundColor: tokens.colors.action.accumulate.bg,
    borderColor: tokens.colors.action.accumulate.border,
  },
  incrementLabel: {
    ...tokens.typography.headingLg,
    color: tokens.colors.action.accumulate.fg,
  },
  brokenBlock: {
    alignItems: 'center',
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[4],
  },
  brokenValue: {
    ...tokens.typography.numericSm,
    color: tokens.colors.field.text,
    marginTop: tokens.spacing[2],
  },
  brokenControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: tokens.spacing[3],
    gap: tokens.spacing[3],
  },
  readingStepButton: {
    minWidth: tokens.touch.field,
    minHeight: tokens.touch.field,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.md,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.secondary.border,
    backgroundColor: tokens.colors.action.secondary.bg,
    paddingHorizontal: tokens.spacing[3],
  },
  readingStepButtonAccent: {
    backgroundColor: tokens.colors.action.accumulate.bg,
    borderColor: tokens.colors.action.accumulate.border,
  },
  readingStepLabel: {
    ...tokens.typography.button,
    color: tokens.colors.action.secondary.fg,
  },
  readingStepLabelAccent: {
    ...tokens.typography.button,
    color: tokens.colors.action.accumulate.fg,
  },
  actionBar: {
    minHeight: tokens.layout.actionBarHeight,
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[4],
    justifyContent: 'center',
    borderTopWidth: tokens.layout.ruleWidth,
    borderTopColor: tokens.colors.field.rule,
  },
  validateButton: {
    minHeight: tokens.touch.field,
    borderRadius: tokens.radii.md,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.commit.border,
    backgroundColor: tokens.colors.action.commit.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validateLabel: {
    ...tokens.typography.button,
    color: tokens.colors.action.commit.fg,
  },
});
