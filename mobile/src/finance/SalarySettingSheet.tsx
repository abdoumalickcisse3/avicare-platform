/**
 * Set a member's monthly salary — mobile port of the web `SalarySettingDialog`.
 *
 * This is the row every salary line is computed from: without at least one active setting,
 * `SalaryGenerateSheet` has nothing to generate and the whole salaries flow is a dead end. The
 * phone could read these settings but never write one, so a farm run from a phone alone could
 * never pay anybody.
 *
 * The backend upserts on the member, so creating for someone who already has a setting would
 * silently overwrite it. The member picker therefore offers only members without one — changing
 * an existing salary is done by opening its row, where the member is fixed.
 *
 * OWNER / MANAGER only (the caller gates the entry point).
 */
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, ChevronDown } from 'lucide-react-native';
import { useUpsertSalarySettingMutation } from '@/store/api/financeApi';
import { tokens } from '@/theme';
import type { SalarySetting } from '@/types';

export function SalarySettingSheet({
  farmId,
  open,
  setting = null,
  members,
  takenUserIds,
  onClose,
  onDone,
}: {
  farmId: number;
  open: boolean;
  /** An existing setting to change, or null to add one. */
  setting?: SalarySetting | null;
  /** Active farm members, the roster the picker chooses from. */
  members: { userId: number; fullName: string }[];
  /** Members that already have a setting — excluded from the picker when adding. */
  takenUserIds: number[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [upsertSetting, { isLoading }] = useUpsertSalarySettingMutation();

  const [userId, setUserId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [active, setActive] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Edge-triggered on `open`: re-seeding on every render would fight the typing.
  useEffect(() => {
    if (open) {
      setUserId(setting?.userId ?? null);
      setAmount(setting != null ? String(setting.monthlySalaryXof) : '');
      setActive(setting?.active ?? true);
      setPickerOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, setting?.id]);

  const selectable = setting
    ? members
    : members.filter((m) => !takenUserIds.includes(m.userId));
  const amountNum = /^\d+$/.test(amount.trim()) ? Number(amount.trim()) : NaN;
  const canSubmit =
    userId !== null && Number.isInteger(amountNum) && amountNum > 0 && !isLoading;

  const memberName = (id: number) =>
    members.find((m) => m.userId === id)?.fullName ?? `Salarié #${id}`;

  const submit = async () => {
    if (!canSubmit || userId === null) return;
    try {
      await upsertSetting({
        farmId,
        body: { userId, monthlySalaryXof: amountNum, active },
      }).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone();
    } catch {
      Alert.alert('Réglage de salaire', "Le réglage n'a pas pu être enregistré. Réessayez.");
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>
          {setting ? 'Modifier le salaire' : 'Nouveau réglage de salaire'}
        </Text>
        <Text style={styles.subtitle}>
          {setting
            ? 'Le nouveau montant vaudra pour les mois générés ensuite, pas pour ceux déjà générés.'
            : 'Le salaire mensuel sert de base à chaque génération.'}
        </Text>

        <Text style={styles.fieldLabel}>Membre</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choisir un membre"
          // The backend keys the setting on the member: changing it would create a second one
          // rather than move the first, so an existing setting keeps its member.
          disabled={setting !== null}
          onPress={() => setPickerOpen((v) => !v)}
          style={[styles.select, setting !== null && styles.selectLocked]}
        >
          <Text style={[styles.selectText, userId === null && styles.selectPlaceholder]}>
            {userId === null ? 'Choisir…' : memberName(userId)}
          </Text>
          {setting === null && <ChevronDown size={18} color={tokens.colors.field.textMuted} />}
        </Pressable>
        {pickerOpen && (
          <View style={styles.picker}>
            <ScrollView style={styles.pickerScroll} keyboardShouldPersistTaps="handled">
              {selectable.length === 0 ? (
                <Text style={styles.pickerEmpty}>
                  Tous les membres ont déjà un réglage de salaire.
                </Text>
              ) : (
                selectable.map((m) => {
                  const on = m.userId === userId;
                  return (
                    <Pressable
                      key={m.userId}
                      accessibilityRole="button"
                      accessibilityLabel={m.fullName}
                      onPress={() => {
                        setUserId(m.userId);
                        setPickerOpen(false);
                      }}
                      style={styles.pickerRow}
                    >
                      <Text style={[styles.pickerRowText, on && styles.pickerRowTextOn]}>
                        {m.fullName}
                      </Text>
                      {on && <Check size={16} color={tokens.colors.primary[600]} />}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}

        <Text style={styles.fieldLabel}>Salaire mensuel (XOF)</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="0"
          placeholderTextColor={tokens.colors.field.disabled}
          accessibilityLabel="Salaire mensuel"
          style={styles.input}
        />

        {setting !== null && (
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Actif</Text>
              {/* Deactivating is how someone stops being paid without erasing the history:
                  generation only ever picks up the active settings. */}
              <Text style={styles.switchHint}>
                Un réglage inactif n&apos;entre plus dans la génération mensuelle.
              </Text>
            </View>
            <Switch
              value={active}
              onValueChange={setActive}
              accessibilityLabel="Réglage actif"
              trackColor={{ false: tokens.colors.neutral[300], true: tokens.colors.primary[400] }}
            />
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enregistrer le réglage de salaire"
          onPress={submit}
          disabled={!canSubmit}
          style={[styles.commit, !canSubmit && styles.commitDisabled]}
        >
          <Text style={styles.commitLabel}>Enregistrer</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(18,43,18,0.35)' },
  sheet: {
    backgroundColor: tokens.colors.neutral[0],
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    padding: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[8],
    gap: tokens.spacing[1],
  },
  title: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginBottom: tokens.spacing[1] },
  fieldLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2] },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[300],
    paddingHorizontal: tokens.spacing[3],
  },
  selectLocked: { backgroundColor: tokens.colors.neutral[50] },
  selectText: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  selectPlaceholder: { color: tokens.colors.field.disabled },
  picker: {
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
    marginTop: tokens.spacing[1],
    overflow: 'hidden',
  },
  pickerScroll: { maxHeight: 180 },
  pickerEmpty: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, padding: tokens.spacing[3] },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.neutral[100],
  },
  pickerRowText: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  pickerRowTextOn: { color: tokens.colors.primary[600], fontWeight: '700' },
  input: {
    minHeight: 46,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[300],
    paddingHorizontal: tokens.spacing[3],
    color: tokens.colors.field.text,
    ...tokens.typography.bodyMd,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    marginTop: tokens.spacing[3],
  },
  switchLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  switchHint: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },
  commit: {
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.accent[400],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing[4],
  },
  commitDisabled: { opacity: 0.4 },
  commitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.primary[900] },
});
