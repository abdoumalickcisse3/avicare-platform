/**
 * Bon d'achat detail — mirrors the web `/stocks/achats/[id]`: header (number +
 * status), supplier, line items (commandé / reçu), total, and the workflow
 * actions. DRAFT → Envoyer (submit), SENT → Réceptionner, which now opens a
 * line-by-line sheet instead of assuming everything arrived. Annuler until received.
 * All gated `inventory:write`.
 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { ReceptionSheet } from '@/inventory/ReceptionSheet';
import {
  useCancelPurchaseOrderMutation,
  useGetPurchaseOrderQuery,
  useReceivePurchaseOrderMutation,
  useSubmitPurchaseOrderMutation,
} from '@/store/api/purchaseOrdersApi';
import { PURCHASE_ORDER_STATUS_LABELS, purchaseOrderStatusColor } from '@/lib/commercial';
import { formatCurrency, formatNumber } from '@/lib/format';

export default function AchatDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const poId = rawId ? Number(rawId) : NaN;

  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { can } = useFarmAccess();
  const canWrite = can('inventory:write');

  const { data: po, isLoading } = useGetPurchaseOrderQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId, id: poId },
  );
  const [submitPO, { isLoading: submitting }] = useSubmitPurchaseOrderMutation();
  const [receivePO, { isLoading: receiving }] = useReceivePurchaseOrderMutation();
  const [receptionOpen, setReceptionOpen] = useState(false);
  const [cancelPO] = useCancelPurchaseOrderMutation();

  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  const run = async (fn: () => Promise<unknown>, label: string) => {
    try {
      await fn();
    } catch {
      Alert.alert(label, "L’action a échoué. Réessayez.");
    }
  };

  const doSubmit = () => run(() => submitPO({ farmId: selectedFarmId, id: poId }).unwrap(), 'Envoyer');
  const doReceive = () => setReceptionOpen(true);
  const doCancel = () =>
    Alert.alert('Annuler le bon d\'achat', `Annuler ${po?.orderNumber} ?`, [
      { text: 'Retour', style: 'cancel' },
      { text: 'Annuler le bon', style: 'destructive', onPress: () => run(() => cancelPO({ farmId: selectedFarmId, id: poId }).unwrap(), 'Annuler') },
    ]);

  const busy = submitting || receiving;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8} style={styles.backBtn}>
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{po?.orderNumber ?? "Bon d'achat"}</Text>
          {po && (
            <Text style={[styles.statusText, { color: purchaseOrderStatusColor(po.status) }]}>
              {PURCHASE_ORDER_STATUS_LABELS[po.status]}
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading || !po ? (
          <Text style={styles.muted}>Chargement…</Text>
        ) : (
          <>
            <Text style={styles.supplier}>{po.supplierName}</Text>
            {po.expectedDeliveryDate && <Text style={styles.due}>Livraison prévue : {po.expectedDeliveryDate}</Text>}

            <Text style={styles.sectionTitle}>Articles</Text>
            <View style={styles.items}>
              {po.items.map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemLabel}>{it.articleLabelSnapshot ?? it.articleKey}</Text>
                    <Text style={styles.itemMeta}>
                      {formatNumber(it.orderedQuantity)} {it.unit ?? ''} × {formatCurrency(it.unitPriceXof)}
                      {it.receivedQuantity > 0 ? ` · reçu ${formatNumber(it.receivedQuantity)}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.itemTotal}>{formatCurrency(it.lineTotalXof)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalCaption}>Total</Text>
              <Text style={styles.totalVal}>{po.totalXof != null ? formatCurrency(po.totalXof) : '—'}</Text>
            </View>
          </>
        )}
      </ScrollView>

      {po && canWrite && (po.status === 'DRAFT' || po.status === 'SENT') && (
        <View style={styles.footer}>
          {po.status === 'DRAFT' && (
            <Pressable accessibilityRole="button" accessibilityLabel="Envoyer le bon d'achat" onPress={doSubmit} disabled={busy} style={[styles.commit, busy && styles.commitDisabled]}>
              <Text style={styles.commitLabel}>Envoyer</Text>
            </Pressable>
          )}
          {po.status === 'SENT' && (
            <Pressable accessibilityRole="button" accessibilityLabel="Réceptionner le bon d'achat" onPress={doReceive} disabled={busy} style={[styles.commit, busy && styles.commitDisabled]}>
              <Text style={styles.commitLabel}>Réceptionner</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="Annuler le bon d'achat" onPress={doCancel} style={styles.cancelBtn}>
            <Text style={styles.cancelLabel}>Annuler</Text>
          </Pressable>
        </View>
      )}

      <ReceptionSheet
        open={receptionOpen}
        order={po}
        saving={receiving}
        onClose={() => setReceptionOpen(false)}
        onSubmit={async (lines) => {
          await run(
            () => receivePO({ farmId: selectedFarmId, id: poId, body: { lines } }).unwrap(),
            'Réceptionner',
          );
          setReceptionOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[2] },
  backBtn: { width: 40, height: 40, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200] },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  statusText: { ...tokens.typography.bodySm, fontWeight: '700', marginTop: 2 },

  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[8] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[6] },
  supplier: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  due: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[1] },
  sectionTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text, marginTop: tokens.spacing[5], marginBottom: tokens.spacing[2] },
  items: { gap: tokens.spacing[2] },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: tokens.spacing[3], borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[200], backgroundColor: tokens.colors.neutral[0] },
  itemLabel: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  itemMeta: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  itemTotal: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.field.text, fontVariant: ['tabular-nums'] },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: tokens.spacing[4] },
  totalCaption: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  totalVal: { ...tokens.typography.displayMd, color: tokens.colors.primary[600], fontVariant: ['tabular-nums'] },

  footer: { flexDirection: 'row', gap: tokens.spacing[3], alignItems: 'center', paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[4], borderTopWidth: tokens.layout.ruleWidth, borderTopColor: tokens.colors.neutral[200], backgroundColor: tokens.colors.neutral[0] },
  commit: { flex: 1, minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.accent[400], alignItems: 'center', justifyContent: 'center' },
  commitDisabled: { opacity: 0.4 },
  commitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.primary[900] },
  cancelBtn: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing[5] },
  cancelLabel: { ...tokens.typography.button, fontSize: 15, color: tokens.colors.field.textMuted },
});
