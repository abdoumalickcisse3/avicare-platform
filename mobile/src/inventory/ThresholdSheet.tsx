/**
 * Set the low-stock threshold — the first screen to use the built-in numeric keypad.
 *
 * A threshold is a small whole number typed once in a barn, with the current stock right above it
 * for comparison. That is exactly the case the pad was built for: the value stays visible, the
 * keys never move, and the system keyboard does not eat half the screen.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily, tokens } from '@/theme';
import { NumericKeypad } from '@/components/field/NumericKeypad';
import { formatNumber } from '@/lib/format';

export function ThresholdSheet({
  open,
  itemName,
  unit,
  currentQuantity,
  currentThreshold,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  itemName: string;
  unit: string | null;
  currentQuantity: number;
  currentThreshold: number | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (threshold: number) => void;
}) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!open) return;
    setValue(currentThreshold != null ? String(currentThreshold) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const parsed = Number(value.replace(',', '.'));
  const valid = value.length > 0 && Number.isFinite(parsed) && parsed >= 0;
  // Warn rather than block: a threshold above the current stock is a legitimate way of saying
  // "I am already short", and it is how the alert gets raised immediately.
  const alreadyBelow = valid && currentQuantity < parsed;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Seuil d&apos;alerte</Text>
        <Text style={styles.subtitle}>{itemName}</Text>

        <View style={styles.readout}>
          <Text style={styles.value} accessibilityLabel="Seuil saisi">
            {value || '0'}
            <Text style={styles.unit}>{unit ? ` ${unit}` : ''}</Text>
          </Text>
          <Text style={styles.compare}>
            En stock : {formatNumber(currentQuantity)}
            {unit ? ` ${unit}` : ''}
          </Text>
          {alreadyBelow ? (
            <Text style={styles.warn}>
              Le stock est déjà sous ce seuil : l&apos;alerte se déclenchera tout de suite.
            </Text>
          ) : null}
        </View>

        <NumericKeypad value={value} onChange={setValue} maxLength={7} allowDecimal />

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
            onPress={() => valid && onSubmit(parsed)}
            disabled={!valid || saving}
            accessibilityRole="button"
            accessibilityLabel="Enregistrer le seuil"
            style={[styles.save, (!valid || saving) && styles.disabled]}
          >
            <Text style={styles.saveText}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
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
    paddingBottom: tokens.spacing[6],
    gap: tokens.spacing[3],
  },
  title: {
    ...tokens.typography.headingLg,
    color: tokens.colors.field.text,
    paddingHorizontal: tokens.layout.screenPadding,
  },
  subtitle: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
    paddingHorizontal: tokens.layout.screenPadding,
  },
  readout: { paddingHorizontal: tokens.layout.screenPadding, gap: tokens.spacing[1] },
  value: { ...tokens.typography.numeric, color: tokens.colors.field.text },
  unit: { fontFamily: fontFamily.sansSemiBold, fontSize: 20, color: tokens.colors.field.textMuted },
  compare: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  warn: { ...tokens.typography.bodySm, color: tokens.colors.warningDark, lineHeight: 18 },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[2],
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
