/**
 * Record a health observation — the mobile equivalent of the web
 * `ObservationDialog` (basic health module): severity, title and free
 * description, date = today.
 *
 * Submitted through the offline queue, like every other field entry — see
 * `vaccination.tsx` for why the two health screens were the exception, and
 * why the clientRef stays out of the body.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft } from 'lucide-react-native';
import { tokens } from '@/theme';
import { FormField, TodayDateField } from '@/components/field/FormField';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { enqueueFieldMutation } from '@/field/enqueueMutation';

function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const SEVERITIES: Array<{ key: 'NORMAL' | 'WARNING' | 'CRITICAL'; label: string; bg: string; fg: string }> = [
  { key: 'NORMAL', label: 'Normal', bg: tokens.colors.infoLight, fg: tokens.colors.infoDark },
  { key: 'WARNING', label: 'Vigilance', bg: tokens.colors.warningLight, fg: tokens.colors.warningDark },
  { key: 'CRITICAL', label: 'Critique', bg: tokens.colors.errorLight, fg: tokens.colors.errorDark },
];

export default function ObservationEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId: string }>();
  const raw = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const unitId = raw ? Number(raw) : NaN;
  const selectedFarmId = useSelector(selectSelectedFarmId);

  const skip = selectedFarmId === null || Number.isNaN(unitId);
  const farmId = selectedFarmId as number;
  const { data: units } = useListProductionUnitsQuery(skip ? skipToken : farmId);
  const unit = units?.find((u) => u.id === unitId);

  const [severity, setSeverity] = useState<'NORMAL' | 'WARNING' | 'CRITICAL'>('NORMAL');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  const canSubmit = !Number.isNaN(unitId) && title.trim().length > 0;

  function handleSubmit(): void {
    if (!canSubmit) return;

    enqueueFieldMutation({
      farmId,
      kind: 'HEALTH_OBSERVATION',
      endpoint: `/api/v1/farms/${farmId}/health/observations`,
      payload: {
        unitId,
        observationDate: todayIsoDate(),
        severity,
        title: title.trim(),
        description: description.trim() || undefined,
      },
    });

    router.back();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retour" style={styles.backBtn}>
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Nouvelle observation</Text>
          <Text style={styles.subtitle}>{unit ? `Lot ${unit.name}` : 'Lot'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TodayDateField label="Date de l'observation" />

        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>Gravité</Text>
          <View style={styles.chips}>
            {SEVERITIES.map((s) => {
              const on = s.key === severity;
              return (
                <Pressable
                  key={s.key}
                  style={[styles.chip, on && { backgroundColor: s.bg, borderColor: s.fg }]}
                  onPress={() => setSeverity(s.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Gravité ${s.label}`}
                >
                  <Text style={[styles.chipText, on && { color: s.fg, fontWeight: '700' }]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <FormField label="Titre" required value={title} onChangeText={setTitle} placeholder="Baisse d'appétit, boiterie…" maxLength={200} />
        <FormField label="Description (facultatif)" value={description} onChangeText={setDescription} placeholder="Symptômes, effectifs concernés, actions prises…" multiline maxLength={1000} />
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable style={styles.cancelBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Annuler">
          <Text style={styles.cancelLabel}>Annuler</Text>
        </Pressable>
        <Pressable style={[styles.submitBtn, !canSubmit && styles.disabled]} onPress={handleSubmit} disabled={!canSubmit} accessibilityRole="button" accessibilityLabel="Enregistrer l'observation">
          <Text style={styles.submitLabel}>Enregistrer</Text>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  chip: { minHeight: tokens.touch.secondary, paddingHorizontal: tokens.spacing[4], alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radii.full, borderWidth: tokens.layout.borderWidth, borderColor: tokens.colors.neutral[300], backgroundColor: tokens.colors.neutral[0] },
  chipText: { ...tokens.typography.button, fontSize: 14, color: tokens.colors.field.textMuted },
  actionBar: { flexDirection: 'row', gap: tokens.spacing[3], paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[4], borderTopWidth: tokens.layout.ruleWidth, borderTopColor: tokens.colors.neutral[200], backgroundColor: tokens.colors.neutral[0] },
  cancelBtn: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing[6] },
  cancelLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.field.textMuted },
  submitBtn: { flex: 1, minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.primary[600], alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  submitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.neutral[0] },
});
