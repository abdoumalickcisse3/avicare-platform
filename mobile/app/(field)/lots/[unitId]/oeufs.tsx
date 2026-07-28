/**
 * Egg collection entry ("Collecte d'œufs") — a faithful replica of the web
 * `EggCollectionDialog`: a date field, a time-slot selector, total/broken egg
 * number fields and an observations field, with an Annuler / Enregistrer
 * footer. Submission goes through the offline `enqueueFieldMutation` queue.
 *
 * clientRef semantics differ from mortality/weighing: the backend upserts a
 * collection on the natural key (unit, date, time-slot), so replaying the same
 * request is already safe. The local queue still needs a stable identity for
 * that (unit, date, slot) so submitting the same slot twice REPLACES the queued
 * draft instead of stacking a second one — this screen derives a deterministic
 * ref from the natural key and removes any existing queue row sharing it before
 * enqueuing (the queue's `client_ref` column is UNIQUE).
 *
 * `timeslotKey` is never hardcoded (doc 00 "Règle d'or n°0"): it comes from the
 * farm's configured time-slots via `layerConfigApi`. Offline with no cached
 * config, submission is disabled with a clear message.
 */
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft } from 'lucide-react-native';
import { tokens } from '@/theme';
import { FormField, TodayDateField } from '@/components/field/FormField';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { useListTimeslotsQuery, type LayerConfigEntry } from '@/store/api/layerConfigApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { enqueueFieldMutation } from '@/field/enqueueMutation';
import { queue } from '@/sync';

const MS_PER_DAY = 86_400_000;

/** Duplicated on purpose — see journalier.tsx's identical helper for why. */
function ageInDays(startDate: string | null | undefined): number | null {
  if (!startDate) return null;
  const start = Date.parse(startDate);
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.floor((Date.now() - start) / MS_PER_DAY));
}

/** Today's date as `YYYY-MM-DD` — see journalier.tsx for why local, not UTC. */
function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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

  const sortedTimeslots = useMemo(
    () => [...(timeslots ?? [])].sort((a, b) => timeslotOrder(a) - timeslotOrder(b)),
    [timeslots],
  );

  const [selectedTimeslotKey, setSelectedTimeslotKey] = useState<string | null>(null);
  const [totalEggs, setTotalEggs] = useState('');
  const [brokenEggs, setBrokenEggs] = useState('');
  const [notes, setNotes] = useState('');

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
  const totalValid = /^\d+$/.test(totalEggs.trim());
  const brokenValid = brokenEggs.trim() === '' || /^\d+$/.test(brokenEggs.trim());
  const canSubmit = selectedTimeslotKey !== null && !Number.isNaN(unitId) && totalValid && brokenValid;

  function handleSubmit(): void {
    if (selectedFarmId === null || Number.isNaN(unitId) || selectedTimeslotKey === null || !totalValid) return;

    const collectionDate = todayIsoDate();
    const ref = slotClientRef(unitId, collectionDate, selectedTimeslotKey);

    // Upsert-per-slot, locally: any existing queue row for this exact
    // (unit, date, slot) is a stale draft of THIS submission — remove it
    // (whatever its status) so the enqueue below never collides with the
    // UNIQUE client_ref constraint, and only the latest values are sent.
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
        totalEggs: Number(totalEggs.trim()),
        brokenEggs: brokenEggs.trim() === '' ? 0 : Number(brokenEggs.trim()),
        notes: notes.trim() || undefined,
      },
      clientRef: ref,
    });

    router.back();
  }

  const age = ageInDays(unit?.startDate);
  const subtitle = unit ? `Lot ${unit.name}${age !== null ? ` · J${age}` : ''}` : 'Lot';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Saisir une collecte</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TodayDateField />

        {/* Time-slot selector — the RN equivalent of the web's <select>. */}
        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>Créneau</Text>
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

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <FormField
              label="Total d'œufs"
              required
              value={totalEggs}
              onChangeText={setTotalEggs}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="0"
            />
          </View>
          <View style={styles.rowItem}>
            <FormField
              label="Œufs cassés"
              value={brokenEggs}
              onChangeText={setBrokenEggs}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="0"
              helperText="Comptés séparément."
            />
          </View>
        </View>

        <FormField
          label="Observations"
          value={notes}
          onChangeText={setNotes}
          placeholder="Conditions, incidents, collecteur…"
          multiline
          maxLength={2000}
        />
      </ScrollView>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Annuler">
          <Text style={styles.cancelLabel}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.validateButton, !canSubmit && styles.validateButtonDisabled]}
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
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[3] },
  backBtn: { width: 40, height: 40, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200] },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },

  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[8], gap: tokens.spacing[4] },

  fieldWrap: { gap: tokens.spacing[1] },
  fieldLabel: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.field.text },
  unavailable: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  timeslotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  timeslotChip: { minHeight: tokens.touch.secondary, paddingHorizontal: tokens.spacing[4], alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radii.full, borderWidth: tokens.layout.borderWidth, borderColor: tokens.colors.neutral[300], backgroundColor: tokens.colors.neutral[0] },
  timeslotChipSelected: { backgroundColor: tokens.colors.primary[600], borderColor: tokens.colors.primary[600] },
  timeslotChipLabel: { ...tokens.typography.button, color: tokens.colors.field.textMuted },
  timeslotChipLabelSelected: { color: tokens.colors.neutral[0] },

  row: { flexDirection: 'row', gap: tokens.spacing[3] },
  rowItem: { flex: 1 },

  actionBar: { flexDirection: 'row', gap: tokens.spacing[3], paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[4], borderTopWidth: tokens.layout.ruleWidth, borderTopColor: tokens.colors.neutral[200], backgroundColor: tokens.colors.neutral[0] },
  cancelButton: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing[6] },
  cancelLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.field.textMuted },
  validateButton: { flex: 1, minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.primary[600], alignItems: 'center', justifyContent: 'center' },
  validateButtonDisabled: { opacity: 0.4 },
  validateLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.neutral[0] },
});
