/**
 * Record a vet visit on a lot — the mobile counterpart of the web `VetVisitDialog`.
 *
 * Two things the screen says out loud, because both surprise people otherwise:
 *
 * - **A cost books an expense.** The server creates a matching farm expense whenever the cost is
 *   above zero. A farmer who types 25 000 here and later finds it in their accounts should have
 *   been told, not have discovered it.
 * - **A follow-up needs a date.** The server refuses a follow-up without one, and refuses a date
 *   before the visit — so the form asks for it as soon as the switch is on.
 *
 * Online-only: a visit carries money, and the offline scope stops before money.
 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft } from 'lucide-react-native';
import { fontFamily, tokens } from '@/theme';
import { ActionBar } from '@/components/field/ActionBar';
import { FormField, TodayDateField } from '@/components/field/FormField';
import { useGetVeterinariansQuery, useRecordVetVisitMutation } from '@/store/api/healthApi';
import { useListProductionUnitsQuery } from '@/store/api/productionUnitsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { addDays, isoToday } from '@/lib/health';

export default function VetVisitEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ unitId: string }>();
  const rawUnitId = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const unitId = rawUnitId ? Number(rawUnitId) : NaN;

  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { data: units } = useListProductionUnitsQuery(selectedFarmId ?? skipToken);
  const unit = units?.find((u) => u.id === unitId);

  const { data: veterinarians = [] } = useGetVeterinariansQuery(
    selectedFarmId ? { farmId: selectedFarmId } : skipToken,
  );
  const [recordVisit, { isLoading }] = useRecordVetVisitMutation();

  const [veterinarianId, setVeterinarianId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [cost, setCost] = useState('');
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpInDays, setFollowUpInDays] = useState('7');

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  const costNum = cost === '' ? 0 : Number(cost);
  const followUpDays = Number(followUpInDays);
  const canSubmit =
    !Number.isNaN(unitId) &&
    reason.trim().length > 0 &&
    (cost === '' || (/^\d+$/.test(cost) && costNum >= 0)) &&
    (!followUpNeeded || (/^\d+$/.test(followUpInDays) && followUpDays >= 0));

  async function handleSubmit(): Promise<void> {
    if (selectedFarmId === null || !canSubmit) return;
    try {
      await recordVisit({
        farmId: selectedFarmId,
        body: {
          unitId,
          veterinarianId: veterinarianId ?? undefined,
          visitDate: isoToday(),
          reason: reason.trim(),
          diagnosis: diagnosis.trim() || undefined,
          costXof: costNum > 0 ? costNum : undefined,
          followUpNeeded,
          // The server refuses a follow-up date before the visit, so it is counted forward
          // from today rather than typed — there is no date a farmer can get wrong here.
          followUpDate: followUpNeeded ? addDays(isoToday(), followUpDays) : undefined,
        },
      }).unwrap();
      router.back();
    } catch {
      Alert.alert(
        'Enregistrement impossible',
        "Vérifiez votre connexion. Si le problème persiste, votre rôle ne permet peut-être pas d'enregistrer une visite.",
      );
    }
  }

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
          <Text style={styles.title}>Visite vétérinaire</Text>
          <Text style={styles.subtitle}>{unit ? `Lot ${unit.name}` : 'Lot'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TodayDateField label="Date de la visite" />

        <Text style={styles.label}>Vétérinaire</Text>
        {veterinarians.length === 0 ? (
          <Text style={styles.muted}>
            Aucun vétérinaire dans votre annuaire. La visite sera enregistrée sans nom.
          </Text>
        ) : (
          <View style={styles.chips}>
            <Pressable
              onPress={() => setVeterinarianId(null)}
              accessibilityRole="button"
              accessibilityLabel="Sans vétérinaire nommé"
              style={[styles.chip, veterinarianId === null && styles.chipActive]}
            >
              <Text
                style={[styles.chipText, veterinarianId === null && styles.chipTextActive]}
              >
                Sans nom
              </Text>
            </Pressable>
            {veterinarians
              .filter((v) => v.active)
              .map((vet) => {
                const active = vet.id === veterinarianId;
                return (
                  <Pressable
                    key={vet.id}
                    onPress={() => setVeterinarianId(vet.id)}
                    accessibilityRole="button"
                    accessibilityLabel={vet.fullName}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {vet.fullName}
                    </Text>
                  </Pressable>
                );
              })}
          </View>
        )}

        <FormField
          label="Motif de la visite"
          required
          value={reason}
          onChangeText={setReason}
          placeholder="Mortalité en hausse, baisse de ponte…"
          maxLength={200}
        />

        <FormField
          label="Diagnostic (facultatif)"
          value={diagnosis}
          onChangeText={setDiagnosis}
          multiline
          maxLength={1000}
        />

        <FormField
          label="Coût (F CFA, facultatif)"
          value={cost}
          onChangeText={setCost}
          keyboardType="number-pad"
          placeholder="0"
          helperText="Un coût saisi ici crée automatiquement une dépense dans votre comptabilité."
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Une visite de suivi est nécessaire</Text>
          <Switch
            value={followUpNeeded}
            onValueChange={setFollowUpNeeded}
            accessibilityLabel="Visite de suivi nécessaire"
          />
        </View>

        {followUpNeeded && (
          <FormField
            label="Dans combien de jours ?"
            required
            value={followUpInDays}
            onChangeText={setFollowUpInDays}
            keyboardType="number-pad"
            helperText={`Suivi prévu le ${addDays(isoToday(), Number(followUpInDays) || 0)
              .split('-')
              .reverse()
              .join('/')}`}
          />
        )}
      </ScrollView>

      <ActionBar>
        <TouchableOpacity
          style={[styles.validate, (!canSubmit || isLoading) && styles.validateDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer la visite"
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
    minHeight: tokens.touch.button,
  },
  switchLabel: { ...tokens.typography.bodyLg, color: tokens.colors.field.text, flex: 1 },
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
