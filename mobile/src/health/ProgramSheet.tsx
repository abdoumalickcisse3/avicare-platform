/**
 * Create, clone or edit a vaccination program's calendar — the mobile counterpart of the web
 * `ProgramDialog`.
 *
 * Three sources, one form:
 * - `entry` set: editing a farm's custom program. The key is fixed (upsert-on-key, like
 *   `HealthCatalogSheet`) even if the label changes.
 * - `cloneFrom` set (`entry` null): a platform program pre-fills the form, but this is a create —
 *   the key is derived fresh from whatever label the farmer ends up with, exactly like a blank
 *   create, not the platform program's own key.
 * - Neither set: a blank create.
 *
 * The payload is catalog JSON in snake_case (`breed_keys`, `vaccine_key`, `age: {value, unit}`),
 * matching what the backend — and the web dialog — already send; a step's `route` is only
 * included when chosen, otherwise the field is left out rather than sent empty.
 */
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, Plus, Trash2 } from 'lucide-react-native';
import { tokens } from '@/theme';
import { KeyboardSafeSheet, sheetBounds } from '@/components/ui';
import { FormField } from '@/components/field/FormField';
import { HEALTH_ROUTE_LABELS, routeLabel } from '@/lib/health';
import { slugify } from './slug';
import type { Breed } from '@/store/api/breedsApi';
import type { Vaccine, VaccinationProgram } from '@/types';

interface ScheduleFormEntry {
  vaccineKey: string;
  ageValue: string;
  ageUnit: 'DAY' | 'WEEK';
  route: string;
  mandatory: boolean;
}

const emptyStep = (): ScheduleFormEntry => ({
  vaccineKey: '',
  ageValue: '',
  ageUnit: 'DAY',
  route: '',
  mandatory: false,
});

export type ProgramSheetProps = {
  open: boolean;
  /** The custom program being edited — its key stays fixed. Null when creating or cloning. */
  entry: VaccinationProgram | null;
  /** A platform program to pre-fill from, when `entry` is null. Still a create: fresh key. */
  cloneFrom: VaccinationProgram | null;
  vaccines: Vaccine[];
  breeds: Breed[];
  /** Every existing program key, to refuse a duplicate before the server does. */
  existingKeys: string[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (key: string, value: Record<string, unknown>) => void;
};

export function ProgramSheet({
  open,
  entry,
  cloneFrom,
  vaccines,
  breeds,
  existingKeys,
  saving,
  onClose,
  onSubmit,
}: ProgramSheetProps) {
  const source = entry ?? cloneFrom;

  const [label, setLabel] = useState('');
  const [breedKeys, setBreedKeys] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<ScheduleFormEntry[]>([emptyStep()]);
  const [vaccinePickerFor, setVaccinePickerFor] = useState<number | null>(null);

  // Edge-triggered on opening, so typing is never overwritten by a refetch behind the sheet.
  useEffect(() => {
    if (!open) return;
    setLabel(source?.label ?? '');
    setBreedKeys(source?.breedKeys ?? []);
    setSchedule(
      source && source.schedule.length > 0
        ? source.schedule.map((s) => ({
            vaccineKey: s.vaccineKey,
            ageValue: String(s.ageValue),
            ageUnit: s.ageUnit === 'WEEK' ? 'WEEK' : 'DAY',
            route: s.route ?? '',
            mandatory: s.mandatory,
          }))
        : [emptyStep()],
    );
    setVaccinePickerFor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.key, cloneFrom?.key]);

  const trimmed = label.trim();
  const key = entry?.key ?? slugify(trimmed);
  const duplicate = entry === null && key !== '' && existingKeys.includes(key);
  const stepsValid = schedule.every((s) => s.vaccineKey !== '' && /^\d+$/.test(s.ageValue));
  const canSubmit =
    trimmed !== '' && key !== '' && !duplicate && breedKeys.length > 0 && stepsValid && !saving;

  const toggleBreed = (code: string) =>
    setBreedKeys((current) =>
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    );

  const updateStep = (index: number, patch: Partial<ScheduleFormEntry>) =>
    setSchedule((current) => current.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const addStep = () => setSchedule((current) => [...current, emptyStep()]);
  const removeStep = (index: number) =>
    setSchedule((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));

  const submit = () => {
    if (!canSubmit) return;
    const value: Record<string, unknown> = {
      label: trimmed,
      species: 'POULTRY',
      breed_keys: breedKeys,
      schedule: schedule.map((s) => ({
        age: { value: Number(s.ageValue), unit: s.ageUnit },
        vaccine_key: s.vaccineKey,
        ...(s.route ? { route: s.route } : {}),
        mandatory: s.mandatory,
      })),
    };
    onSubmit(key, value);
  };

  const title = entry ? 'Modifier le programme' : cloneFrom ? 'Cloner le programme' : 'Nouveau programme';

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardSafeSheet>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose} />
      <View style={styles.sheet}>
      <Text style={styles.title}>{title}</Text>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormField
          label="Nom du programme"
          required
          value={label}
          onChangeText={setLabel}
          placeholder="Standard chair"
          maxLength={120}
          error={duplicate ? 'Un programme porte déjà ce nom' : undefined}
        />

        <View>
          <Text style={styles.label}>Races ciblées</Text>
          <View style={styles.chips}>
            {breeds.map((b) => {
              const active = breedKeys.includes(b.code);
              return (
                <Pressable
                  key={b.code}
                  onPress={() => toggleBreed(b.code)}
                  accessibilityRole="button"
                  accessibilityLabel={b.name}
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{b.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Étapes du calendrier</Text>
        {schedule.map((step, index) => {
          const pickerOpen = vaccinePickerFor === index;
          const selectedVaccine = vaccines.find((v) => v.key === step.vaccineKey);
          return (
            <View key={index} style={styles.step}>
              <View style={styles.stepRow}>
                <Pressable
                  onPress={() => setVaccinePickerFor(pickerOpen ? null : index)}
                  accessibilityRole="button"
                  accessibilityLabel="Vaccin"
                  style={styles.select}
                >
                  <Text style={[styles.selectText, !selectedVaccine && styles.selectPlaceholder]}>
                    {selectedVaccine?.label ?? 'Choisir un vaccin…'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => removeStep(index)}
                  disabled={schedule.length === 1}
                  accessibilityRole="button"
                  accessibilityLabel="Retirer l'étape"
                  accessibilityState={{ disabled: schedule.length === 1 }}
                  hitSlop={8}
                  style={[styles.removeBtn, schedule.length === 1 && styles.removeBtnDisabled]}
                >
                  <Trash2 size={18} color={tokens.colors.error} />
                </Pressable>
              </View>

              {pickerOpen && (
                <View style={styles.picker}>
                  {vaccines.map((v) => (
                    <Pressable
                      key={v.key}
                      onPress={() => {
                        updateStep(index, { vaccineKey: v.key });
                        setVaccinePickerFor(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={v.label}
                      style={styles.pickerRow}
                    >
                      <Text style={styles.pickerRowText}>{v.label}</Text>
                      {v.key === step.vaccineKey && (
                        <Check size={16} color={tokens.colors.primary[600]} />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={styles.stepRow}>
                <FormField
                  label="Âge"
                  value={step.ageValue}
                  onChangeText={(v: string) => updateStep(index, { ageValue: v })}
                  keyboardType="number-pad"
                  placeholder="7"
                  style={styles.ageInput}
                />
                <View style={styles.unitChips}>
                  {(['DAY', 'WEEK'] as const).map((unit) => {
                    const active = step.ageUnit === unit;
                    return (
                      <Pressable
                        key={unit}
                        onPress={() => updateStep(index, { ageUnit: unit })}
                        accessibilityRole="button"
                        accessibilityLabel={unit === 'DAY' ? 'Jours' : 'Semaines'}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {unit === 'DAY' ? 'Jours' : 'Semaines'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Text style={styles.label}>Voie</Text>
              <View style={styles.chips}>
                <Pressable
                  onPress={() => updateStep(index, { route: '' })}
                  accessibilityRole="button"
                  accessibilityLabel="Aucune voie"
                  style={[styles.chip, step.route === '' && styles.chipActive]}
                >
                  <Text style={[styles.chipText, step.route === '' && styles.chipTextActive]}>
                    Aucune
                  </Text>
                </Pressable>
                {Object.keys(HEALTH_ROUTE_LABELS).map((routeKey) => {
                  const active = step.route === routeKey;
                  return (
                    <Pressable
                      key={routeKey}
                      onPress={() => updateStep(index, { route: routeKey })}
                      accessibilityRole="button"
                      accessibilityLabel={routeLabel(routeKey)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {routeLabel(routeKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => updateStep(index, { mandatory: !step.mandatory })}
                accessibilityRole="checkbox"
                accessibilityLabel="Obligatoire"
                accessibilityState={{ checked: step.mandatory }}
                style={styles.checkboxRow}
              >
                <View style={[styles.checkbox, step.mandatory && styles.checkboxOn]}>
                  {step.mandatory && <Check size={14} color={tokens.colors.neutral[0]} />}
                </View>
                <Text style={styles.checkboxLabel}>Obligatoire</Text>
              </Pressable>
            </View>
          );
        })}

        <Pressable
          onPress={addStep}
          accessibilityRole="button"
          accessibilityLabel="Ajouter une étape"
          style={styles.addStep}
        >
          <Plus size={16} color={tokens.colors.primary[600]} />
          <Text style={styles.addStepText}>Ajouter une étape</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Annuler" style={styles.cancel}>
          <Text style={styles.cancelText}>Annuler</Text>
        </Pressable>
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer"
          style={[styles.save, !canSubmit && styles.saveDisabled]}
        >
          <Text style={styles.saveText}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
        </Pressable>
      </View>
      </View>
      </KeyboardSafeSheet>
    </Modal>
  );
}

/** Confirms removing a custom program, naming what it will not undo. */
export function confirmProgramDelete(labelText: string, onConfirm: () => void): void {
  Alert.alert(
    `Retirer ${labelText} ?`,
    'Les lots déjà suivis avec ce calendrier gardent leurs vaccinations enregistrées ; seule '
      + "l'assignation à de nouveaux lots disparaît.",
    [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: onConfirm },
    ],
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28, 25, 23, 0.45)' },
  sheet: {
    backgroundColor: tokens.colors.field.background,
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingTop: tokens.spacing[5],
    ...sheetBounds,
  },
  title: {
    ...tokens.typography.headingLg,
    color: tokens.colors.field.text,
    paddingHorizontal: tokens.layout.screenPadding,
    marginBottom: tokens.spacing[3],
  },
  content: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[4],
    gap: tokens.spacing[4],
  },
  label: { ...tokens.typography.label, color: tokens.colors.field.textMuted },
  sectionTitle: {
    ...tokens.typography.bodyMd,
    fontWeight: '700',
    color: tokens.colors.field.text,
  },
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
  chipTextActive: { color: tokens.colors.action.accumulate.fg },
  step: {
    gap: tokens.spacing[3],
    padding: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.field.ruleSubtle,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  select: {
    flex: 1,
    minHeight: tokens.touch.field,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[3],
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.neutral[300],
    borderRadius: tokens.radii.md,
  },
  selectText: { ...tokens.typography.bodyLg, color: tokens.colors.field.text },
  selectPlaceholder: { color: tokens.colors.field.disabled },
  picker: {
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.neutral[300],
    borderRadius: tokens.radii.md,
    overflow: 'hidden',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: tokens.touch.field,
    paddingHorizontal: tokens.spacing[3],
  },
  pickerRowText: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  ageInput: { width: 90 },
  unitChips: { flexDirection: 'row', gap: tokens.spacing[2] },
  removeBtn: {
    minWidth: tokens.touch.min,
    minHeight: tokens.touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnDisabled: { opacity: 0.35 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: tokens.radii.sm,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: tokens.colors.primary[600],
    borderColor: tokens.colors.primary[600],
  },
  checkboxLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  addStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[2],
    alignSelf: 'flex-start',
  },
  addStepText: { ...tokens.typography.button, color: tokens.colors.primary[600] },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[3],
    paddingBottom: tokens.spacing[6],
    borderTopWidth: 1,
    borderTopColor: tokens.colors.field.ruleSubtle,
  },
  cancel: {
    minHeight: tokens.touch.primaryButton,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing[6],
  },
  cancelText: { ...tokens.typography.button, color: tokens.colors.field.textMuted },
  save: {
    flex: 1,
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.commit.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.commit.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDisabled: { opacity: 0.4 },
  saveText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
