/**
 * Enregistrer un mouvement de stock — a field-friendly subset of the web stock
 * movement form: Entrée (IN) / Sortie (OUT), a quantity, a curated reason and an
 * optional note → recordMovement. The backend adjusts the stock item and alerts.
 */
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRecordMovementMutation } from '@/store/api/inventoryStockApi';
import { formatNumber } from '@/lib/format';
import { tokens } from '@/theme';
import type { MovementReason, MovementType, StockItem } from '@/types';

const REASONS: Record<'IN' | 'OUT', { value: MovementReason; label: string }[]> = {
  IN: [
    { value: 'RECEPTION_PURCHASE', label: 'Réception' },
    { value: 'GIFT', label: 'Don' },
  ],
  OUT: [
    { value: 'CONSUMPTION_LOT', label: 'Consommation' },
    { value: 'LOSS', label: 'Perte' },
  ],
};

export function StockMovementSheet({
  farmId,
  item,
  name,
  open,
  onClose,
  onDone,
}: {
  farmId: number;
  item: StockItem;
  name: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [recordMovement, { isLoading }] = useRecordMovementMutation();
  const [type, setType] = useState<'IN' | 'OUT'>('IN');
  const [reason, setReason] = useState<MovementReason>('RECEPTION_PURCHASE');
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');

  const switchType = (t: 'IN' | 'OUT') => {
    setType(t);
    setReason(REASONS[t][0]!.value);
  };

  const quantity = /^\d+$/.test(qty.trim()) ? Number(qty.trim()) : NaN;
  const canSubmit = Number.isInteger(quantity) && quantity >= 1;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await recordMovement({
        farmId,
        body: { stockItemId: item.id, movementType: type as MovementType, quantity, reason, notes: notes.trim() || undefined },
      }).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone();
    } catch {
      Alert.alert('Mouvement', "Le mouvement n’a pas pu être enregistré. Réessayez.");
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.stock}>
          En stock : {formatNumber(item.currentQuantity)} {item.unit ?? ''}
        </Text>

        <View style={styles.toggle}>
          {(['IN', 'OUT'] as const).map((t) => (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityLabel={t === 'IN' ? 'Entrée' : 'Sortie'}
              onPress={() => switchType(t)}
              style={[styles.toggleBtn, type === t && (t === 'IN' ? styles.toggleInOn : styles.toggleOutOn)]}
            >
              <Text style={[styles.toggleLabel, type === t && styles.toggleLabelOn]}>
                {t === 'IN' ? 'Entrée' : 'Sortie'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Quantité ({item.unit ?? 'unité'})</Text>
        <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad" inputMode="numeric" placeholder="0" accessibilityLabel="Quantité" style={styles.input} />

        <Text style={styles.fieldLabel}>Motif</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {REASONS[type].map((r) => (
            <Pressable key={r.value} accessibilityRole="button" accessibilityLabel={r.label} onPress={() => setReason(r.value)} style={[styles.chip, reason === r.value && styles.chipOn]}>
              <Text style={[styles.chipLabel, reason === r.value && styles.chipLabelOn]}>{r.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <TextInput value={notes} onChangeText={setNotes} placeholder="Note (optionnel)" accessibilityLabel="Note" style={[styles.input, { marginTop: tokens.spacing[2] }]} maxLength={120} />

        <Pressable accessibilityRole="button" accessibilityLabel="Enregistrer le mouvement" onPress={submit} disabled={!canSubmit || isLoading} style={[styles.commit, (!canSubmit || isLoading) && styles.commitDisabled]}>
          <Text style={styles.commitLabel}>Enregistrer</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(18,43,18,0.35)' },
  sheet: { backgroundColor: tokens.colors.neutral[0], borderTopLeftRadius: tokens.radii.xl, borderTopRightRadius: tokens.radii.xl, padding: tokens.layout.screenPadding, paddingBottom: tokens.spacing[8], gap: tokens.spacing[2] },
  title: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  stock: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  toggle: { flexDirection: 'row', gap: tokens.spacing[2], marginTop: tokens.spacing[1] },
  toggleBtn: { flex: 1, paddingVertical: tokens.spacing[2], borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], alignItems: 'center' },
  toggleInOn: { backgroundColor: tokens.colors.primary[600], borderColor: tokens.colors.primary[600] },
  toggleOutOn: { backgroundColor: tokens.colors.accent[500], borderColor: tokens.colors.accent[500] },
  toggleLabel: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  toggleLabelOn: { color: tokens.colors.neutral[0] },
  fieldLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2] },
  input: { minHeight: 46, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], paddingHorizontal: tokens.spacing[3], color: tokens.colors.field.text },
  chipRow: { gap: tokens.spacing[2], paddingVertical: 2 },
  chip: { paddingHorizontal: tokens.spacing[3], paddingVertical: tokens.spacing[2], borderRadius: tokens.radii.full, borderWidth: 1, borderColor: tokens.colors.neutral[300], backgroundColor: tokens.colors.neutral[0] },
  chipOn: { backgroundColor: tokens.colors.primary[600], borderColor: tokens.colors.primary[600] },
  chipLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.text },
  chipLabelOn: { color: tokens.colors.neutral[0], fontWeight: '600' },
  commit: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.accent[400], alignItems: 'center', justifyContent: 'center', marginTop: tokens.spacing[3] },
  commitDisabled: { opacity: 0.4 },
  commitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.primary[900] },
});
