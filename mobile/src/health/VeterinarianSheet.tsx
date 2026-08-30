/**
 * Add or edit a veterinarian — the mobile counterpart of the web `VeterinarianDialog`.
 *
 * The phone number carries more weight here than anywhere else in the app: this directory exists
 * so a farmer can reach a vet from a barn at six in the morning, which is why it is the second
 * field and not buried under a "contact" heading.
 *
 * Removing a vet is soft server-side. Past visits keep pointing at the row, so a directory that
 * was cleaned up does not turn a year of records into anonymous visits.
 */
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import type { Veterinarian, VeterinarianInput } from '@/types';

export type VeterinarianSheetProps = {
  open: boolean;
  /** The vet being edited, or null to add one. */
  vet: Veterinarian | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (body: VeterinarianInput) => void;
};

export function VeterinarianSheet({ open, vet, saving, onClose, onSubmit }: VeterinarianSheetProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [speciality, setSpeciality] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (!open) return;
    setFullName(vet?.fullName ?? '');
    setPhone(vet?.phone ?? '');
    setSpeciality(vet?.speciality ?? '');
    setLocation(vet?.location ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vet?.id]);

  const canSubmit = fullName.trim().length > 0 && !saving;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
      speciality: speciality.trim() || undefined,
      location: location.trim() || undefined,
    });
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{vet ? 'Modifier le vétérinaire' : 'Nouveau vétérinaire'}</Text>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FormField
            label="Nom complet"
            required
            value={fullName}
            onChangeText={setFullName}
            placeholder="Dr Aminata Sow"
            maxLength={150}
          />
          <FormField
            label="Téléphone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="77 000 00 00"
            maxLength={40}
            helperText="Le numéro que vous composerez depuis le poulailler."
          />
          <FormField
            label="Spécialité"
            value={speciality}
            onChangeText={setSpeciality}
            placeholder="Aviaire"
            maxLength={120}
          />
          <FormField
            label="Localisation"
            value={location}
            onChangeText={setLocation}
            placeholder="Thiès"
            maxLength={120}
          />
        </ScrollView>

        <View style={styles.actions}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Annuler" style={styles.cancel}>
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Enregistrer le vétérinaire"
            style={[styles.save, !canSubmit && styles.saveDisabled]}
          >
            <Text style={styles.saveText}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Confirms a removal, stating what it does not do — past visits keep their vet. */
export function confirmVeterinarianRemoval(name: string, onConfirm: () => void): void {
  Alert.alert(
    `Retirer ${name} ?`,
    "Ce vétérinaire n'apparaîtra plus dans les listes, mais les visites déjà enregistrées gardent son nom.",
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
