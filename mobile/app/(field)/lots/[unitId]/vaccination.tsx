/**
 * Record a vaccination — the mobile equivalent of the web `VaccinationDialog`
 * (basic health module). Vaccine picked from the farm catalog, subjects
 * defaulting to the unit's current count, date = today. Submitted online via
 * the `recordVaccination` mutation (invalidates the unit's vaccinations + farm
 * alerts, so the Sanitaire lists refresh immediately).
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft } from 'lucide-react-native';
import { tokens } from '@/theme';
import { FormField, TodayDateField } from '@/components/field/FormField';
import { useGetVaccinesQuery, useRecordVaccinationMutation } from '@/store/api/healthApi';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { humanizeKey } from '@/lib/health';

function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function VaccinationEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId: string }>();
  const raw = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const unitId = raw ? Number(raw) : NaN;
  const selectedFarmId = useSelector(selectSelectedFarmId);

  const skip = selectedFarmId === null || Number.isNaN(unitId);
  const farmId = selectedFarmId as number;
  const { data: units } = useListProductionUnitsQuery(skip ? skipToken : farmId);
  const { data: vaccines } = useGetVaccinesQuery(skip ? skipToken : { farmId });
  const [record, { isLoading }] = useRecordVaccinationMutation();

  const unit = units?.find((u) => u.id === unitId);

  const [vaccineKey, setVaccineKey] = useState<string | null>(null);
  const [route, setRoute] = useState('');
  const [subjects, setSubjects] = useState('');
  const [notes, setNotes] = useState('');

  // Default subjects to the current headcount once the unit loads.
  useEffect(() => {
    if (subjects === '' && unit) setSubjects(String(unit.currentCount));
  }, [unit, subjects]);

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  const subjectsValid = /^\d+$/.test(subjects.trim()) && Number(subjects.trim()) > 0;
  const canSubmit = !Number.isNaN(unitId) && !!vaccineKey && subjectsValid && !isLoading;

  async function handleSubmit(): Promise<void> {
    if (!canSubmit || !vaccineKey) return;
    try {
      await record({
        farmId,
        body: {
          unitId,
          vaccineKey,
          administeredDate: todayIsoDate(),
          route: route.trim() || undefined,
          subjectsCount: Number(subjects.trim()),
          notes: notes.trim() || undefined,
        },
      }).unwrap();
      router.back();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      Alert.alert('Enregistrement impossible', status === 403 ? 'Action non autorisée pour votre rôle.' : "L'enregistrement a échoué. Réessayez.");
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retour" style={styles.backBtn}>
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Nouvelle vaccination</Text>
          <Text style={styles.subtitle}>{unit ? `Lot ${unit.name}` : 'Lot'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TodayDateField label="Date d'administration" />

        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>Vaccin <Text style={styles.req}>*</Text></Text>
          {!vaccines || vaccines.length === 0 ? (
            <Text style={styles.muted}>Aucun vaccin dans la bibliothèque. Ajoutez-en depuis Réglages › Sanitaire (web).</Text>
          ) : (
            <View style={styles.chips}>
              {vaccines.map((v) => {
                const on = v.key === vaccineKey;
                return (
                  <Pressable key={v.key} style={[styles.chip, on && styles.chipOn]} onPress={() => setVaccineKey(v.key)} accessibilityRole="button" accessibilityLabel={`Vaccin ${humanizeKey(v.key)}`}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{humanizeKey(v.key)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <FormField label="Sujets vaccinés" required value={subjects} onChangeText={setSubjects} keyboardType="number-pad" inputMode="numeric" placeholder="0" />
        <FormField label="Voie d'administration (facultatif)" value={route} onChangeText={setRoute} placeholder="Eau de boisson, sous-cutanée, oculaire…" />
        <FormField label="Notes (facultatif)" value={notes} onChangeText={setNotes} placeholder="Lot de vaccin, remarques…" multiline maxLength={1000} />
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable style={styles.cancelBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Annuler">
          <Text style={styles.cancelLabel}>Annuler</Text>
        </Pressable>
        <Pressable style={[styles.submitBtn, !canSubmit && styles.disabled]} onPress={handleSubmit} disabled={!canSubmit} accessibilityRole="button" accessibilityLabel="Enregistrer la vaccination">
          <Text style={styles.submitLabel}>{isLoading ? 'Enregistrement…' : 'Enregistrer'}</Text>
        </Pressable>
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
  fieldWrap: { gap: tokens.spacing[2] },
  fieldLabel: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.field.text },
  req: { color: tokens.colors.error },
  muted: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  chip: { minHeight: tokens.touch.secondary, paddingHorizontal: tokens.spacing[4], alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radii.full, borderWidth: tokens.layout.borderWidth, borderColor: tokens.colors.neutral[300], backgroundColor: tokens.colors.neutral[0] },
  chipOn: { backgroundColor: tokens.colors.primary[600], borderColor: tokens.colors.primary[600] },
  chipText: { ...tokens.typography.button, fontSize: 14, color: tokens.colors.field.textMuted },
  chipTextOn: { color: tokens.colors.neutral[0] },
  actionBar: { flexDirection: 'row', gap: tokens.spacing[3], paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[4], borderTopWidth: tokens.layout.ruleWidth, borderTopColor: tokens.colors.neutral[200], backgroundColor: tokens.colors.neutral[0] },
  cancelBtn: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing[6] },
  cancelLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.field.textMuted },
  submitBtn: { flex: 1, minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.primary[600], alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  submitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.neutral[0] },
});
