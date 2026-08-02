/**
 * Encaissement sheet — record a payment against one of a client's open
 * invoices (mirrors the web recordPayment). Pick an invoice (preselects the
 * first), confirm an amount (defaults to the invoice's outstanding balance) and
 * a method, then POST `recordPayment`. Online-only; OWNER/MANAGER gate the
 * entry point. Bold polish lands in the next task.
 */
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRecordPaymentMutation } from '@/store/api/paymentsApi';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from '@/lib/commercial';
import { formatCurrency } from '@/lib/format';
import { tokens } from '@/theme';
import type { Invoice, PaymentMethod } from '@/types';

export function PaymentSheet({
  farmId,
  invoices,
  open,
  onClose,
  onDone,
}: {
  farmId: number;
  invoices: Invoice[];
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [recordPayment, { isLoading }] = useRecordPaymentMutation();
  const [invoiceId, setInvoiceId] = useState<number>(() => invoices[0]?.id ?? 0);
  const [amount, setAmount] = useState<number>(() => invoices[0]?.outstandingXof ?? 0);
  const [method, setMethod] = useState<PaymentMethod>('CASH');

  const selected = invoices.find((i) => i.id === invoiceId) ?? invoices[0];

  const pickInvoice = (inv: Invoice) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInvoiceId(inv.id);
    setAmount(inv.outstandingXof);
  };

  const confirm = async () => {
    if (!selected || amount <= 0) return;
    try {
      await recordPayment({ farmId, body: { invoiceId: selected.id, amountXof: amount, method } }).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone();
    } catch (err) {
      const message =
        (err as { data?: { detail?: string; message?: string } })?.data?.detail ??
        (err as { data?: { message?: string } })?.data?.message ??
        'L’encaissement n’a pas pu être enregistré. Réessayez.';
      Alert.alert('Encaissement', message);
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose}>
        <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>
      <View style={styles.sheet}>
        <Text style={styles.title}>Encaisser un paiement</Text>

        {invoices.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {invoices.map((inv) => (
              <Chip
                key={inv.id}
                label={`${inv.invoiceNumber} · ${formatCurrency(inv.outstandingXof)}`}
                active={inv.id === invoiceId}
                onPress={() => pickInvoice(inv)}
              />
            ))}
          </ScrollView>
        )}

        {selected && (
          <View style={styles.selectedRow}>
            <Text style={styles.selectedLabel}>{selected.invoiceNumber}</Text>
            <Text style={styles.selectedBalance}>Solde {formatCurrency(selected.outstandingXof)}</Text>
          </View>
        )}

        <Text style={styles.fieldLabel}>Montant reçu</Text>
        <TextInput
          value={String(amount)}
          onChangeText={(t) => setAmount(Number(t.replace(/[^0-9]/g, '')) || 0)}
          keyboardType="number-pad"
          inputMode="numeric"
          accessibilityLabel="Montant reçu"
          style={styles.amountInput}
        />

        <View style={styles.chipRow}>
          {PAYMENT_METHOD_OPTIONS.map((m) => (
            <Chip key={m} label={PAYMENT_METHOD_LABELS[m]} active={method === m} onPress={() => setMethod(m)} />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirmer l'encaissement"
          onPress={confirm}
          disabled={!selected || amount <= 0 || isLoading}
          style={[styles.commit, (!selected || amount <= 0 || isLoading) && styles.commitDisabled]}
        >
          <LinearGradient
            colors={[tokens.colors.accent[300], tokens.colors.accent[500]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.commitLabel}>Encaisser {formatCurrency(amount)}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(18,43,18,0.25)' },
  sheet: {
    backgroundColor: tokens.colors.neutral[0],
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    padding: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[8],
    gap: tokens.spacing[3],
  },
  title: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  selectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  selectedLabel: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  selectedBalance: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, fontVariant: ['tabular-nums'] },
  fieldLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  amountInput: {
    minHeight: 48,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[300],
    paddingHorizontal: tokens.spacing[3],
    ...tokens.typography.numericSm,
    fontSize: 20,
    color: tokens.colors.field.text,
    fontVariant: ['tabular-nums'],
  },
  commit: {
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.accent[400],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing[2],
    overflow: 'hidden',
  },
  commitDisabled: { opacity: 0.4 },
  commitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.primary[900] },

  chip: {
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
    borderRadius: tokens.radii.full,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[300],
    backgroundColor: tokens.colors.neutral[0],
  },
  chipActive: { backgroundColor: tokens.colors.primary[600], borderColor: tokens.colors.primary[600] },
  chipLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.text },
  chipLabelActive: { color: tokens.colors.neutral[0], fontWeight: '600' },
});
