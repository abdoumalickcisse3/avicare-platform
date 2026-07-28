/**
 * Broiler daily entry ("Suivi journalier") — a faithful replica of the web
 * `DailyRecordDialog`: labeled date / number / text fields (record date,
 * mortality, feed kg, water L, observations) with an Annuler / Enregistrer
 * footer. Submission goes through the offline `enqueueFieldMutation` queue
 * instead of a direct mutation, so an entry captured with no signal still
 * lands once the device reconnects.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft } from 'lucide-react-native';
import { tokens } from '@/theme';
import { FormField, TodayDateField } from '@/components/field/FormField';
import { FeedSourceSection } from '@/components/inventory/FeedSourceSection';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useFarmAccess } from '@/auth/useSession';
import { formatNumber } from '@/lib/format';
import { enqueueFieldMutation } from '@/field/enqueueMutation';
import type { FeedFormulaRef, StockConsumption } from '@/types';

const MS_PER_DAY = 86_400_000;

/** Duplicated on purpose from `lots/[unitId]/index.tsx` — route files are pages,
 * not shared modules, and this is a two-line date computation. */
function ageInDays(startDate: string | null | undefined): number | null {
  if (!startDate) return null;
  const start = Date.parse(startDate);
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.floor((Date.now() - start) / MS_PER_DAY));
}

/** Today's date as `YYYY-MM-DD`, the upsert key the backend expects — built
 * from local calendar fields, not `toISOString()` (which reads the UTC date). */
function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Parse a decimal field ("1,5" / "1.5") → number, or undefined when empty/NaN.
 * Mirrors the web dialog's `numField`. */
function numField(v: string): number | undefined {
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

export default function DailyEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId: string }>();
  const rawUnitId = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const unitId = rawUnitId ? Number(rawUnitId) : NaN;

  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { can } = useFarmAccess();
  const canStock = can('inventory:consume') || can('inventory:read');

  const { data: units } = useListProductionUnitsQuery(selectedFarmId ?? skipToken);
  const unit = units?.find((u) => u.id === unitId);

  const [mortality, setMortality] = useState('');
  const [feedKg, setFeedKg] = useState('');
  const [waterL, setWaterL] = useState('');
  const [observations, setObservations] = useState('');
  const [feedConsumption, setFeedConsumption] = useState<StockConsumption | null>(null);
  const [feedFormula, setFeedFormula] = useState<FeedFormulaRef | null>(null);

  // Hooks above run unconditionally (rules of hooks); the redirect below
  // only happens once every hook ran, same as the other field screens.
  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  const mortalityValid = /^\d+$/.test(mortality.trim());
  const canSubmit = !Number.isNaN(unitId) && mortalityValid;

  function handleValidate(): void {
    if (selectedFarmId === null || !canSubmit) return;

    enqueueFieldMutation({
      farmId: selectedFarmId,
      kind: 'DAILY_RECORD',
      endpoint: `/api/v1/farms/${selectedFarmId}/poultry-batches/${unitId}/daily-records`,
      payload: {
        recordDate: todayIsoDate(),
        mortalityCount: Number(mortality.trim()),
        feedKg: numField(feedKg),
        waterL: numField(waterL),
        observations: observations.trim() || undefined,
        feedConsumption: feedConsumption ?? undefined,
        feedFormula: feedFormula ?? undefined,
      },
    });

    router.back();
  }

  const age = ageInDays(unit?.startDate);
  const subtitle = unit ? `Lot ${unit.name}${age !== null ? ` · J${age}` : ''}` : 'Lot';
  const mortalityHelper = unit
    ? `Sujets morts, déduits de l'effectif (${formatNumber(unit.currentCount)})`
    : 'Nombre de sujets morts (déduit de l’effectif)';

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
          <Text style={styles.title}>Nouvelle saisie</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TodayDateField label="Date de la saisie" />

        <FormField
          label="Mortalité du jour"
          required
          value={mortality}
          onChangeText={setMortality}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="0"
          helperText={mortalityHelper}
        />

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <FormField
              label="Aliment (kg)"
              value={feedKg}
              onChangeText={setFeedKg}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="0"
            />
          </View>
          <View style={styles.rowItem}>
            <FormField
              label="Eau (L)"
              value={waterL}
              onChangeText={setWaterL}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="0"
            />
          </View>
        </View>

        <FormField
          label="Observations"
          value={observations}
          onChangeText={setObservations}
          placeholder="Comportement, symptômes, interventions…"
          multiline
          maxLength={1000}
        />

        {/* Feed drawn from stock (D18/D20) — mirrors the web FeedSourceSection.
            Shown only to members who can consume/read stock. */}
        {canStock && (
          <FeedSourceSection
            farmId={selectedFarmId}
            onChange={(fc, ff) => {
              setFeedConsumption(fc);
              setFeedFormula(ff);
            }}
          />
        )}
      </ScrollView>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Annuler">
          <Text style={styles.cancelLabel}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.validateButton, !canSubmit && styles.validateButtonDisabled]}
          onPress={handleValidate}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer la saisie"
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
  row: { flexDirection: 'row', gap: tokens.spacing[3] },
  rowItem: { flex: 1 },

  actionBar: { flexDirection: 'row', gap: tokens.spacing[3], paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[4], borderTopWidth: tokens.layout.ruleWidth, borderTopColor: tokens.colors.neutral[200], backgroundColor: tokens.colors.neutral[0] },
  cancelButton: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing[6] },
  cancelLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.field.textMuted },
  validateButton: { flex: 1, minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.primary[600], alignItems: 'center', justifyContent: 'center' },
  validateButtonDisabled: { opacity: 0.4 },
  validateLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.neutral[0] },
});
