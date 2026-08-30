/**
 * Add or edit a custom vaccine or treatment — the mobile counterpart of the web
 * `VaccineLibraryDialog` and `TreatmentLibraryDialog`, merged into one sheet.
 *
 * One component rather than two because the difference between them is three fields, and two
 * near-identical sheets drift: the day a rule changes, one of them gets it.
 *
 * Two things the caller must know:
 *
 * - **Create and edit are the same call.** The backend upserts on the key, so editing reuses the
 *   entry's existing key and only creating derives one from the label. Re-deriving on edit would
 *   create a second entry and orphan everything pointing at the first.
 * - **The value map is snake_case.** It is stored as platform catalog JSON, not as a typed
 *   column, and the readers expect `withdrawal_days_meat`, not `withdrawalDaysMeat`.
 */
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fontFamily, tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import { HEALTH_ROUTE_LABELS, routeLabel } from '@/lib/health';
import { slugify } from './slug';
import type { Treatment, Vaccine } from '@/types';

export type HealthCatalogSheetProps = {
  open: boolean;
  kind: 'vaccine' | 'treatment';
  /** The entry being edited, or null to create one. */
  entry: Vaccine | Treatment | null;
  /** Every existing key, to refuse a duplicate before the server does. */
  existingKeys: string[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (key: string, value: Record<string, unknown>) => void;
};

export function HealthCatalogSheet({
  open,
  kind,
  entry,
  existingKeys,
  saving,
  onClose,
  onSubmit,
}: HealthCatalogSheetProps) {
  const [label, setLabel] = useState('');
  const [disease, setDisease] = useState('');
  const [molecule, setMolecule] = useState('');
  const [routes, setRoutes] = useState<string[]>([]);
  const [meatDays, setMeatDays] = useState('');
  const [eggDays, setEggDays] = useState('');

  // Edge-triggered on opening, so typing is never overwritten by a refetch behind the sheet.
  useEffect(() => {
    if (!open) return;
    setLabel(entry?.label ?? '');
    setDisease((entry as Vaccine | null)?.disease ?? '');
    setMolecule((entry as Treatment | null)?.molecule ?? '');
    setRoutes(
      (entry as Treatment | null)?.routes ??
        ((entry as Vaccine | null)?.route ? [(entry as Vaccine).route] : []),
    );
    setMeatDays(
      (entry as Treatment | null)?.withdrawalDaysMeat != null
        ? String((entry as Treatment).withdrawalDaysMeat)
        : '',
    );
    setEggDays(
      (entry as Treatment | null)?.withdrawalDaysEggs != null
        ? String((entry as Treatment).withdrawalDaysEggs)
        : '',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.key]);

  const trimmed = label.trim();
  const key = entry?.key ?? slugify(trimmed);
  const duplicate = entry === null && key !== '' && existingKeys.includes(key);
  const canSubmit = trimmed !== '' && key !== '' && !duplicate && !saving;

  const toggleRoute = (routeKey: string) =>
    setRoutes((current) =>
      current.includes(routeKey)
        ? current.filter((r) => r !== routeKey)
        : [...current, routeKey],
    );

  const submit = () => {
    if (!canSubmit) return;
    const value: Record<string, unknown> = { label: trimmed };

    if (kind === 'vaccine') {
      if (disease.trim()) value.disease = disease.trim();
      if (routes[0]) value.route = routes[0];
    } else {
      if (molecule.trim()) value.molecule = molecule.trim();
      if (routes.length > 0) value.routes = routes;
      // snake_case: this is catalog JSON, and the readers expect these exact names.
      if (/^\d+$/.test(meatDays)) value.withdrawal_days_meat = Number(meatDays);
      if (/^\d+$/.test(eggDays)) value.withdrawal_days_eggs = Number(eggDays);
    }

    onSubmit(key, value);
  };

  const isVaccine = kind === 'vaccine';

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>
          {entry
            ? isVaccine
              ? 'Modifier le vaccin'
              : 'Modifier le traitement'
            : isVaccine
              ? 'Nouveau vaccin'
              : 'Nouveau traitement'}
        </Text>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FormField
            label="Nom"
            required
            value={label}
            onChangeText={setLabel}
            placeholder={isVaccine ? 'Newcastle La Sota' : 'Amoxicilline 50%'}
            maxLength={120}
            error={duplicate ? `Un ${isVaccine ? 'vaccin' : 'traitement'} porte déjà ce nom` : undefined}
          />

          {isVaccine ? (
            <FormField
              label="Maladie ciblée"
              value={disease}
              onChangeText={setDisease}
              placeholder="Newcastle"
              maxLength={120}
            />
          ) : (
            <FormField
              label="Molécule"
              value={molecule}
              onChangeText={setMolecule}
              placeholder="Amoxicilline"
              maxLength={120}
            />
          )}

          <Text style={styles.label}>
            {isVaccine ? "Voie d'administration" : "Voies d'administration"}
          </Text>
          <View style={styles.chips}>
            {Object.keys(HEALTH_ROUTE_LABELS).map((routeKey) => {
              const active = routes.includes(routeKey);
              return (
                <Pressable
                  key={routeKey}
                  onPress={() => (isVaccine ? setRoutes([routeKey]) : toggleRoute(routeKey))}
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

          {!isVaccine && (
            <>
              <FormField
                label="Délai d'attente viande (jours)"
                value={meatDays}
                onChangeText={setMeatDays}
                keyboardType="number-pad"
                placeholder="7"
                helperText="Laisser vide si aucun délai n'est officiellement déclaré."
              />
              <FormField
                label="Délai d'attente œufs (jours)"
                value={eggDays}
                onChangeText={setEggDays}
                keyboardType="number-pad"
                placeholder="2"
              />
            </>
          )}

          {entry && (
            <Text style={styles.muted}>
              La clé « {entry.key} » ne change pas, même si vous renommez l&apos;entrée : les lots
              et traitements qui la référencent la retrouveraient sinon vide.
            </Text>
          )}
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
    </Modal>
  );
}

/** Confirms a destructive catalog removal, naming what it will not undo. */
export function confirmCatalogDelete(labelText: string, onConfirm: () => void): void {
  Alert.alert(
    `Retirer ${labelText} ?`,
    "Les traitements et vaccinations déjà enregistrés avec cette entrée ne sont pas supprimés : ils gardent le nom et le délai qui s'appliquaient le jour où ils ont été saisis.",
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
    maxHeight: '88%',
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
  muted: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, lineHeight: 18 },
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
