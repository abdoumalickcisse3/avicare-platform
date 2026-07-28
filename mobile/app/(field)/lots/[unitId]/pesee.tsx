/**
 * Weighing sample entry ("Pesée") — a faithful replica of the web
 * `WeighingDialog`: a date field, a free-text "poids individuels" field
 * ("1850, 1920, 2010…" split on commas/spaces), a live stats preview
 * (moyenne / min / max / écart-type / uniformité) and a notes field, with an
 * Annuler / Enregistrer footer. Submission goes through the offline
 * `enqueueFieldMutation` queue.
 *
 * clientRef semantics mirror mortality: the weighing endpoint has server-side
 * replay dedup (Task 2) on a `client_ref` in the body, so this screen mints ONE
 * ref per submission and reuses it verbatim in the payload and the queue row.
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import * as Crypto from 'expo-crypto';
import { ArrowLeft } from 'lucide-react-native';
import { tokens } from '@/theme';
import { FormField, TodayDateField } from '@/components/field/FormField';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { enqueueFieldMutation } from '@/field/enqueueMutation';

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

/** Parse a free-text list of weights ("1850, 1920 2010") — mirrors the web. */
function parseWeights(raw: string): number[] {
  return raw
    .split(/[\s,;]+/)
    .map((t) => Number(t.replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0);
}

interface Stats {
  count: number;
  avg: number;
  min: number;
  max: number;
  std: number;
  uniformity: number;
}

/** Mean, range, population std-dev and uniformity (% within ±10% of mean). */
function computeStats(weights: number[]): Stats | null {
  if (weights.length === 0) return null;
  const count = weights.length;
  const avg = weights.reduce((s, w) => s + w, 0) / count;
  const variance = weights.reduce((s, w) => s + (w - avg) ** 2, 0) / count;
  const within = weights.filter((w) => Math.abs(w - avg) <= avg * 0.1).length;
  return {
    count,
    avg,
    min: Math.min(...weights),
    max: Math.max(...weights),
    std: Math.sqrt(variance),
    uniformity: (within / count) * 100,
  };
}

export default function WeighingEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId: string }>();
  const rawUnitId = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const unitId = rawUnitId ? Number(rawUnitId) : NaN;

  const selectedFarmId = useSelector(selectSelectedFarmId);

  const { data: units } = useListProductionUnitsQuery(selectedFarmId ?? skipToken);
  const unit = units?.find((u) => u.id === unitId);

  const [weightsRaw, setWeightsRaw] = useState('');
  const [notes, setNotes] = useState('');

  const weights = useMemo(() => parseWeights(weightsRaw), [weightsRaw]);
  const stats = useMemo(() => computeStats(weights), [weights]);

  // Hooks above run unconditionally (rules of hooks); the redirect below
  // only happens once every hook ran, same as the other field screens.
  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  const canSubmit = !Number.isNaN(unitId) && weights.length >= 2;

  function handleSubmit(): void {
    if (selectedFarmId === null || !canSubmit) return;

    const ref = Crypto.randomUUID();
    enqueueFieldMutation({
      farmId: selectedFarmId,
      kind: 'WEIGHING',
      endpoint: `/api/v1/farms/${selectedFarmId}/poultry-batches/${unitId}/weighings`,
      payload: {
        sampleDate: todayIsoDate(),
        individualWeights: weights,
        notes: notes.trim() || undefined,
        clientRef: ref,
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
          <Text style={styles.title}>Nouvelle pesée</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TodayDateField label="Date de la pesée" />

        <FormField
          label="Poids individuels (g)"
          value={weightsRaw}
          onChangeText={setWeightsRaw}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="1850, 1920, 2010, 1880…"
          multiline
          helperText="Séparez chaque poids par une virgule ou un espace."
        />

        {stats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Aperçu — {stats.count} sujets pesés</Text>
            <View style={styles.statsRow}>
              <StatBox label="Moyenne" value={String(Math.round(stats.avg))} unit="g" />
              <StatBox label="Min" value={String(Math.round(stats.min))} unit="g" />
              <StatBox label="Max" value={String(Math.round(stats.max))} unit="g" />
              <StatBox label="Écart-type" value={stats.std.toFixed(1)} unit="g" />
              <StatBox label="Uniformité" value={String(Math.round(stats.uniformity))} unit="%" />
            </View>
          </View>
        )}

        <FormField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Conditions de pesée, remarques…"
          multiline
          maxLength={1000}
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
          accessibilityLabel="Enregistrer la pesée"
        >
          <Text style={styles.validateLabel}>Enregistrer la pesée</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function StatBox({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value}
        {unit ? <Text style={styles.statUnit}>{` ${unit}`}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[3] },
  backBtn: { width: 40, height: 40, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200] },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },

  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[8], gap: tokens.spacing[4] },

  statsCard: { backgroundColor: tokens.colors.primary[50], borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.primary[100], padding: tokens.spacing[4] },
  statsTitle: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.primary[700], marginBottom: tokens.spacing[3] },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[3], justifyContent: 'space-between' },
  statBox: { alignItems: 'center', minWidth: 56 },
  statLabel: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted },
  statValue: { ...tokens.typography.numericSm, fontSize: 15, color: tokens.colors.neutral[800], marginTop: 2 },
  statUnit: { ...tokens.typography.bodySm, fontSize: 10, color: tokens.colors.neutral[500] },

  actionBar: { flexDirection: 'row', gap: tokens.spacing[3], paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[4], borderTopWidth: tokens.layout.ruleWidth, borderTopColor: tokens.colors.neutral[200], backgroundColor: tokens.colors.neutral[0] },
  cancelButton: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing[5] },
  cancelLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.field.textMuted },
  validateButton: { flex: 1, minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.primary[600], alignItems: 'center', justifyContent: 'center' },
  validateButtonDisabled: { opacity: 0.4 },
  validateLabel: { ...tokens.typography.button, fontSize: 15, color: tokens.colors.neutral[0] },
});
