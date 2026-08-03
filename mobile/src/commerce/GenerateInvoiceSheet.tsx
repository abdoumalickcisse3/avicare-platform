/**
 * Générer une facture — mobile port of the web `InvoiceDialog`. Toggle the
 * source (Vente / Livraison), pick an eligible one (a COMPLETED sale or a
 * DELIVERED delivery not yet invoiced), set an optional due date, then generate
 * via createInvoiceFromSale / createInvoiceFromDelivery. OWNER/MANAGER gate the
 * entry point (WRITE_MANAGER).
 */
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  useCreateInvoiceFromDeliveryMutation,
  useCreateInvoiceFromSaleMutation,
  useGetInvoicesQuery,
} from '@/store/api/invoicesApi';
import { useGetSalesQuery } from '@/store/api/salesApi';
import { useGetDeliveriesQuery } from '@/store/api/deliveriesApi';
import { formatCurrency } from '@/lib/format';
import { tokens } from '@/theme';

type Source = 'SALE' | 'DELIVERY';

export function GenerateInvoiceSheet({
  farmId,
  open,
  onClose,
  onDone,
}: {
  farmId: number;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: invoices } = useGetInvoicesQuery({ farmId });
  const { data: sales } = useGetSalesQuery({ farmId });
  const { data: deliveries } = useGetDeliveriesQuery({ farmId });
  const [fromSale] = useCreateInvoiceFromSaleMutation();
  const [fromDelivery] = useCreateInvoiceFromDeliveryMutation();

  const [source, setSource] = useState<Source>('SALE');
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');

  const invoicedSaleIds = useMemo(
    () => new Set((invoices ?? []).filter((i) => i.saleId != null).map((i) => i.saleId)),
    [invoices],
  );
  const invoicedDeliveryIds = useMemo(
    () => new Set((invoices ?? []).filter((i) => i.deliveryId != null).map((i) => i.deliveryId)),
    [invoices],
  );
  const eligibleSales = useMemo(
    () => (sales ?? []).filter((s) => s.status === 'COMPLETED' && !invoicedSaleIds.has(s.id)),
    [sales, invoicedSaleIds],
  );
  const eligibleDeliveries = useMemo(
    () => (deliveries ?? []).filter((d) => d.status === 'DELIVERED' && !invoicedDeliveryIds.has(d.id)),
    [deliveries, invoicedDeliveryIds],
  );

  const options =
    source === 'SALE'
      ? eligibleSales.map((s) => ({ id: s.id, label: s.saleNumber, total: s.totalXof }))
      : eligibleDeliveries.map((d) => ({ id: d.id, label: d.deliveryNumber, total: d.totalXof }));

  const switchSource = (s: Source) => {
    setSource(s);
    setSourceId(null);
  };

  const submit = async () => {
    if (sourceId == null) return;
    try {
      if (source === 'SALE') {
        await fromSale({ farmId, saleId: sourceId, dueDate: dueDate || undefined }).unwrap();
      } else {
        await fromDelivery({ farmId, deliveryId: sourceId, dueDate: dueDate || undefined }).unwrap();
      }
      onDone();
    } catch {
      Alert.alert('Facture', "La facture n’a pas pu être générée. Réessayez.");
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} accessibilityLabel="Fermer" onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Nouvelle facture</Text>

        <View style={styles.toggle}>
          {(['SALE', 'DELIVERY'] as const).map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={s === 'SALE' ? 'Depuis une vente' : 'Depuis une livraison'}
              onPress={() => switchSource(s)}
              style={[styles.toggleBtn, source === s && styles.toggleBtnOn]}
            >
              <Text style={[styles.toggleLabel, source === s && styles.toggleLabelOn]}>
                {s === 'SALE' ? 'Vente' : 'Livraison'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Source à facturer</Text>
        <ScrollView style={{ maxHeight: 260 }}>
          {options.length === 0 ? (
            <Text style={styles.muted}>
              {source === 'SALE' ? 'Aucune vente à facturer.' : 'Aucune livraison à facturer.'}
            </Text>
          ) : (
            options.map((o) => (
              <Pressable
                key={o.id}
                accessibilityRole="button"
                accessibilityLabel={o.label}
                onPress={() => setSourceId(o.id)}
                style={[styles.optionRow, sourceId === o.id && styles.optionRowOn]}
              >
                <Text style={[styles.optionLabel, sourceId === o.id && styles.optionLabelOn]}>{o.label}</Text>
                <Text style={styles.optionTotal}>{formatCurrency(o.total)}</Text>
              </Pressable>
            ))
          )}
        </ScrollView>

        <Text style={styles.fieldLabel}>Échéance (AAAA-MM-JJ, optionnel)</Text>
        <TextInput
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="2026-08-31"
          accessibilityLabel="Date d'échéance"
          style={styles.input}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Générer la facture"
          onPress={submit}
          disabled={sourceId == null}
          style={[styles.commit, sourceId == null && styles.commitDisabled]}
        >
          <Text style={styles.commitLabel}>Générer la facture</Text>
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
    gap: tokens.spacing[2],
  },
  title: { ...tokens.typography.headingMd, color: tokens.colors.field.text, marginBottom: tokens.spacing[1] },
  toggle: { flexDirection: 'row', gap: tokens.spacing[2] },
  toggleBtn: { flex: 1, paddingVertical: tokens.spacing[2], borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], alignItems: 'center' },
  toggleBtnOn: { backgroundColor: tokens.colors.primary[600], borderColor: tokens.colors.primary[600] },
  toggleLabel: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  toggleLabelOn: { color: tokens.colors.neutral[0] },

  fieldLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, paddingVertical: tokens.spacing[4] },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing[3],
    paddingHorizontal: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    marginBottom: tokens.spacing[2],
  },
  optionRowOn: { borderColor: tokens.colors.primary[600], backgroundColor: tokens.colors.primary[50] },
  optionLabel: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  optionLabelOn: { color: tokens.colors.primary[700] },
  optionTotal: { ...tokens.typography.bodyMd, color: tokens.colors.field.text, fontVariant: ['tabular-nums'] },

  input: { minHeight: 46, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], paddingHorizontal: tokens.spacing[3], color: tokens.colors.field.text },
  commit: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.accent[400], alignItems: 'center', justifyContent: 'center', marginTop: tokens.spacing[3] },
  commitDisabled: { opacity: 0.4 },
  commitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.primary[900] },
});
