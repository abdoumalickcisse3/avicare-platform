/**
 * Edit the farm — and, for an owner, delete it.
 *
 * The form carries fields it never displays. `PUT /farms/{id}` is a replacement: the service
 * assigns description, location, gps and capacity straight from the request, so anything omitted
 * is written as null. GPS coordinates in particular have no editor on mobile (no map picker), and
 * would be silently erased by the first name change made from a phone. They are loaded, held, and
 * sent back untouched.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fontFamily, tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import type { Farm, FarmInput } from '@/store/api/farmsApi';

export type FarmSheetProps = {
  open: boolean;
  /** The farm to edit, or undefined to create one. */
  farm: Farm | undefined;
  saving: boolean;
  /** Only an OWNER sees the delete path; MANAGER may edit but not delete. */
  canDelete: boolean;
  onClose: () => void;
  onSubmit: (body: FarmInput) => void;
  onDelete: () => void;
};

const digits = (s: string) => s.replace(/[^\d]/g, '');

export function FarmSheet({
  open,
  farm,
  saving,
  canDelete,
  onClose,
  onSubmit,
  onDelete,
}: FarmSheetProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(farm?.name ?? '');
    setDescription(farm?.description ?? '');
    setLocation(farm?.location ?? '');
    setCapacity(farm?.capacity != null ? String(farm.capacity) : '');
    setConfirmName('');
    setDeleting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, farm?.id]);

  const canSubmit = name.trim().length > 0 && !saving;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      capacity: capacity ? Number(capacity) : null,
      // Carried through untouched — not editable here, and a PUT would erase them.
      gpsLatitude: farm?.gpsLatitude ?? null,
      gpsLongitude: farm?.gpsLongitude ?? null,
    });
  };

  const deleteArmed = confirmName.trim().toLowerCase() === (farm?.name ?? '').trim().toLowerCase();

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>
          {farm ? 'Paramètres de la ferme' : 'Nouvelle ferme'}
        </Text>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FormField
            label="Nom de la ferme"
            required
            value={name}
            onChangeText={setName}
            placeholder="Ferme de Thiès"
            maxLength={200}
          />
          <FormField
            label="Localisation"
            value={location}
            onChangeText={setLocation}
            placeholder="Thiès"
            maxLength={500}
          />
          <FormField
            label="Capacité (sujets)"
            value={capacity}
            onChangeText={(t) => setCapacity(digits(t))}
            keyboardType="number-pad"
            placeholder="5000"
            helperText="Capacité totale des bâtiments, tous lots confondus."
          />
          <FormField
            label="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={2000}
          />

          {canDelete ? (
            <View style={styles.dangerZone}>
              {!deleting ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Supprimer la ferme"
                  onPress={() => setDeleting(true)}
                  style={styles.dangerBtn}
                >
                  <Text style={styles.dangerText}>Supprimer la ferme</Text>
                </Pressable>
              ) : (
                <>
                  <Text style={styles.dangerTitle}>Supprimer « {farm?.name} »</Text>
                  <Text style={styles.dangerBody}>
                    Les lots, les saisies, les ventes et la comptabilité de cette ferme
                    disparaissent de l&apos;application. Le serveur ne demande aucune
                    confirmation : écrivez le nom de la ferme pour armer le bouton.
                  </Text>
                  <FormField
                    label="Nom de la ferme"
                    value={confirmName}
                    onChangeText={setConfirmName}
                    autoCapitalize="none"
                    placeholder={farm?.name ?? ''}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Confirmer la suppression de la ferme"
                    disabled={!deleteArmed}
                    onPress={onDelete}
                    style={[styles.dangerSolid, !deleteArmed && styles.disabled]}
                  >
                    <Text style={styles.dangerSolidText}>Supprimer définitivement</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Annuler"
            style={styles.cancel}
          >
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={farm ? 'Enregistrer la ferme' : 'Créer la ferme'}
            style={[styles.save, !canSubmit && styles.disabled]}
          >
            <Text style={styles.saveText}>
              {saving ? 'Enregistrement…' : farm ? 'Enregistrer' : 'Créer la ferme'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28, 25, 23, 0.45)' },
  sheet: {
    backgroundColor: tokens.colors.field.background,
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    paddingTop: tokens.spacing[5],
    maxHeight: '90%',
  },
  title: {
    ...tokens.typography.headingLg,
    color: tokens.colors.field.text,
    paddingHorizontal: tokens.layout.screenPadding,
    marginBottom: tokens.spacing[2],
  },
  content: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[4],
    gap: tokens.spacing[4],
  },
  dangerZone: {
    gap: tokens.spacing[3],
    borderTopWidth: 1,
    borderTopColor: tokens.colors.field.ruleSubtle,
    paddingTop: tokens.spacing[4],
  },
  dangerTitle: {
    ...tokens.typography.bodyMd,
    fontFamily: fontFamily.sansSemiBold,
    color: tokens.colors.action.danger.border,
  },
  dangerBody: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, lineHeight: 19 },
  dangerBtn: {
    minHeight: tokens.touch.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.danger.border,
  },
  dangerText: {
    ...tokens.typography.button,
    color: tokens.colors.action.danger.border,
    fontFamily: fontFamily.sansSemiBold,
  },
  dangerSolid: {
    minHeight: tokens.touch.primaryButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.action.danger.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.danger.border,
  },
  dangerSolidText: { ...tokens.typography.button, color: tokens.colors.action.danger.fg },
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
  disabled: { opacity: 0.4 },
  saveText: { ...tokens.typography.button, color: tokens.colors.action.commit.fg },
});
