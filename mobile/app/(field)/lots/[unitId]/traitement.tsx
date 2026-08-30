/**
 * Record a treatment on a lot — the mobile counterpart of the web `TreatmentDialog`.
 *
 * The screen leads with the medication because the medication decides everything after it: the
 * route it can be given by, and the withdrawal delay it opens. Picking one previews the earliest
 * sale dates immediately, using the same arithmetic the server will apply — so the farmer sees
 * the consequence before committing, not after.
 *
 * Online-only, deliberately. `TREATMENT` exists as a queue kind for the assistant, but a
 * treatment recorded offline would compute its withdrawal against a stale catalog, and a wrong
 * sale date is worse than a delayed entry. The spec locks money and traceability writes online.
 */
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft } from 'lucide-react-native';
import { fontFamily, tokens } from '@/theme';
import { ActionBar } from '@/components/field/ActionBar';
import { Counter } from '@/components/field/Counter';
import { FormField, TodayDateField } from '@/components/field/FormField';
import { WithdrawalNotice } from '@/components/health/WithdrawalNotice';
import { useGetTreatmentLibraryQuery, useRecordTreatmentMutation } from '@/store/api/healthApi';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { isoToday, projectWithdrawal, routeLabel } from '@/lib/health';
import { formatNumber } from '@/lib/format';

export default function TreatmentEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId: string }>();
  const rawUnitId = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const unitId = rawUnitId ? Number(rawUnitId) : NaN;

  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { data: units } = useListProductionUnitsQuery(selectedFarmId ?? skipToken);
  const unit = units?.find((u) => u.id === unitId);

  const { data: catalog = [] } = useGetTreatmentLibraryQuery(
    selectedFarmId ? { farmId: selectedFarmId } : skipToken,
  );
  const [recordTreatment, { isLoading }] = useRecordTreatmentMutation();

  const [treatmentKey, setTreatmentKey] = useState('');
  const [durationDays, setDurationDays] = useState(3);
  const [doseAmount, setDoseAmount] = useState('');
  const [doseUnit, setDoseUnit] = useState('');
  const [route, setRoute] = useState('');
  const [subjects, setSubjects] = useState('');
  const [reason, setReason] = useState('');

  const selected = useMemo(
    () => catalog.find((t) => t.key === treatmentKey),
    [catalog, treatmentKey],
  );

  const preview = useMemo(() => {
    if (!selected) return null;
    return projectWithdrawal(
      isoToday(),
      durationDays,
      selected.withdrawalDaysMeat,
      selected.withdrawalDaysEggs,
    );
  }, [selected, durationDays]);

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  const doseNum = Number(doseAmount.replace(',', '.'));
  const subjectsNum = Number(subjects);
  const canSubmit =
    !Number.isNaN(unitId) &&
    treatmentKey !== '' &&
    durationDays >= 1 &&
    doseAmount !== '' &&
    !Number.isNaN(doseNum) &&
    doseNum > 0 &&
    doseUnit.trim() !== '' &&
    route !== '' &&
    /^\d+$/.test(subjects) &&
    subjectsNum > 0;

  async function handleSubmit(): Promise<void> {
    if (selectedFarmId === null || !canSubmit) return;
    try {
      await recordTreatment({
        farmId: selectedFarmId,
        body: {
          unitId,
          treatmentKey,
          startDate: isoToday(),
          durationDays,
          doseAmount: doseNum,
          doseUnit: doseUnit.trim(),
          route,
          subjectsCount: subjectsNum,
          reason: reason.trim() || undefined,
        },
      }).unwrap();
      router.back();
    } catch {
      Alert.alert(
        'Enregistrement impossible',
        "Vérifiez votre connexion. Si le problème persiste, votre rôle ne permet peut-être pas d'enregistrer un traitement.",
      );
    }
  }

  const pickTreatment = (key: string) => {
    setTreatmentKey(key);
    // The catalog knows how this medication is given; presetting the route saves the farmer a
    // decision they cannot get wrong from a list of one.
    const entry = catalog.find((t) => t.key === key);
    const firstRoute = entry?.routes?.[0];
    if (firstRoute) setRoute(firstRoute);
  };

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
          <Text style={styles.title}>Traitement</Text>
          <Text style={styles.subtitle}>{unit ? `Lot ${unit.name}` : 'Lot'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TodayDateField label="Début du traitement" />

        <Text style={styles.label}>Médicament</Text>
        {catalog.length === 0 ? (
          <Text style={styles.muted}>
            Aucun traitement dans la bibliothèque. Ajoutez-en depuis Réglages › Sanitaire.
          </Text>
        ) : (
          <View style={styles.chips}>
            {catalog.map((entry) => {
              const active = entry.key === treatmentKey;
              return (
                <Pressable
                  key={entry.key}
                  onPress={() => pickTreatment(entry.key)}
                  accessibilityRole="button"
                  accessibilityLabel={entry.label}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {entry.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {selected && (
          <Text style={styles.muted}>
            {`${selected.molecule || 'Molécule non renseignée'} · délai légal : ${
              selected.withdrawalDaysEggs ?? '?'
            } j œufs / ${selected.withdrawalDaysMeat ?? '?'} j viande`}
          </Text>
        )}

        <Counter
          label="Durée du traitement (jours)"
          value={durationDays}
          onChange={setDurationDays}
          min={1}
          max={60}
          helperText="Le premier jour compte."
        />

        <FormField
          label="Dose"
          required
          value={doseAmount}
          onChangeText={setDoseAmount}
          keyboardType="decimal-pad"
          placeholder="1"
        />
        <FormField
          label="Unité de dose"
          required
          value={doseUnit}
          onChangeText={setDoseUnit}
          placeholder="g/1000L"
        />

        <Text style={styles.label}>Voie d&apos;administration</Text>
        <View style={styles.chips}>
          {(selected?.routes?.length ? selected.routes : ['drinking_water', 'injectable', 'oral']).map(
            (key) => {
              const active = key === route;
              return (
                <Pressable
                  key={key}
                  onPress={() => setRoute(key)}
                  accessibilityRole="button"
                  accessibilityLabel={routeLabel(key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {routeLabel(key)}
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>

        <FormField
          label="Sujets traités"
          required
          value={subjects}
          onChangeText={setSubjects}
          keyboardType="number-pad"
          placeholder="0"
          helperText={
            unit ? `Effectif actuel : ${formatNumber(unit.currentCount)} sujets` : undefined
          }
        />

        <FormField
          label="Motif (facultatif)"
          value={reason}
          onChangeText={setReason}
          placeholder="Diarrhée, baisse d'appétit…"
          maxLength={200}
        />

        {/* Shown before saving, computed exactly as the server will: the farmer sees when they
            may sell again while they can still change the duration. */}
        {preview && (
          <WithdrawalNotice
            withdrawalEndDateMeat={preview.withdrawalEndDateMeat}
            withdrawalEndDateEggs={preview.withdrawalEndDateEggs}
          />
        )}
      </ScrollView>

      <ActionBar>
        <TouchableOpacity
          style={[styles.validate, (!canSubmit || isLoading) && styles.validateDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer le traitement"
        >
          <Text style={styles.validateLabel}>
            {isLoading ? 'Enregistrement…' : 'Enregistrer'}
          </Text>
        </TouchableOpacity>
      </ActionBar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[3],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
  },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },
  content: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[8],
    gap: tokens.spacing[4],
  },
  label: { ...tokens.typography.label, color: tokens.colors.field.textMuted },
  muted: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  chip: {
    minHeight: tokens.touch.button,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[4],
    borderRadius: tokens.radii.full,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
  },
  chipActive: {
    backgroundColor: tokens.colors.action.accumulate.bg,
    borderColor: tokens.colors.action.accumulate.border,
  },
  chipText: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  chipTextActive: { color: tokens.colors.action.accumulate.fg, fontFamily: fontFamily.sansSemiBold },
  validate: {
    minHeight: tokens.touch.cta,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.commit.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.commit.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validateDisabled: { opacity: 0.4 },
  validateLabel: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
