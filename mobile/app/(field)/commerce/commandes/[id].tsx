/**
 * Commande (order) detail — mirrors the web `/commercial/commandes/[id]`: header
 * with number + status, client, expected delivery, line items, total, and the
 * workflow actions. PENDING → Confirmer, CONFIRMED → Préparer (WRITE_FARMER:
 * OWNER/MANAGER/FARMER); Annuler is OWNER/MANAGER (WRITE_MANAGER). Creating the
 * delivery ("Livrer") is a separate flow (follow-up).
 */
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import {
  useCancelOrderMutation,
  useConfirmOrderMutation,
  useGetOrderQuery,
  useStartOrderPreparationMutation,
} from '@/store/api/ordersApi';
import { useCreateDeliveryFromOrderMutation } from '@/store/api/deliveriesApi';
import { useGetClientsQuery } from '@/store/api/clientsApi';
import { ORDER_STATUS_LABELS, orderStatusColor } from '@/lib/commercial';
import { formatCurrency, formatNumber } from '@/lib/format';

export default function CommandeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const orderId = rawId ? Number(rawId) : NaN;

  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { farmRole } = useFarmAccess();
  const canAdvance = farmRole === 'OWNER' || farmRole === 'MANAGER' || farmRole === 'FARMER';
  const canCancel = farmRole === 'OWNER' || farmRole === 'MANAGER';

  const { data: order, isLoading } = useGetOrderQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId, id: orderId },
  );
  const { data: clients } = useGetClientsQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId },
  );

  const [confirmOrder, { isLoading: confirming }] = useConfirmOrderMutation();
  const [startPreparation, { isLoading: preparing }] = useStartOrderPreparationMutation();
  const [cancelOrder] = useCancelOrderMutation();
  const [createDelivery, { isLoading: delivering }] = useCreateDeliveryFromOrderMutation();

  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  const clientName =
    order?.clientId == null
      ? 'Client de passage'
      : (clients?.find((c) => c.id === order?.clientId)?.displayName ?? 'Client');

  const run = async (fn: () => Promise<unknown>, label: string) => {
    try {
      await fn();
    } catch {
      Alert.alert(label, "L’action a échoué. Réessayez.");
    }
  };

  const doConfirm = () => run(() => confirmOrder({ farmId: selectedFarmId, id: orderId }).unwrap(), 'Confirmer');
  const doPrepare = () => run(() => startPreparation({ farmId: selectedFarmId, id: orderId }).unwrap(), 'Préparer');
  const doDeliver = () =>
    Alert.alert('Livrer la commande', `Créer la livraison de ${order?.orderNumber} ? Le stock sera décrémenté.`, [
      { text: 'Retour', style: 'cancel' },
      {
        text: 'Livrer',
        onPress: () => run(() => createDelivery({ farmId: selectedFarmId, body: { orderId } }).unwrap(), 'Livrer'),
      },
    ]);
  const doCancel = () =>
    Alert.alert('Annuler la commande', `Annuler ${order?.orderNumber} ?`, [
      { text: 'Retour', style: 'cancel' },
      {
        text: 'Annuler la commande',
        style: 'destructive',
        onPress: () => run(() => cancelOrder({ farmId: selectedFarmId, id: orderId }).unwrap(), 'Annuler'),
      },
    ]);

  const busy = confirming || preparing || delivering;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8} style={styles.backBtn}>
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{order?.orderNumber ?? 'Commande'}</Text>
          {order && (
            <Text style={[styles.statusText, { color: orderStatusColor(order.status) }]}>
              {ORDER_STATUS_LABELS[order.status]}
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading || !order ? (
          <Text style={styles.muted}>Chargement…</Text>
        ) : (
          <>
            <Text style={styles.client}>{clientName}</Text>
            {order.expectedDeliveryDate && (
              <Text style={styles.due}>Livraison prévue : {order.expectedDeliveryDate}</Text>
            )}

            <Text style={styles.sectionTitle}>Lignes</Text>
            <View style={styles.items}>
              {order.items.map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemLabel}>{it.articleLabelSnapshot ?? it.articleKey}</Text>
                    <Text style={styles.itemMeta}>
                      {formatNumber(it.quantity)} {it.unit} × {formatCurrency(it.unitPriceXof)}
                    </Text>
                  </View>
                  <Text style={styles.itemTotal}>{formatCurrency(it.lineTotalXof)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalCaption}>Total</Text>
              <Text style={styles.totalVal}>{formatCurrency(order.totalXof)}</Text>
            </View>
          </>
        )}
      </ScrollView>

      {order && (order.status === 'PENDING' || order.status === 'CONFIRMED' || order.status === 'IN_PROGRESS') && (
        <View style={styles.footer}>
          {order.status === 'PENDING' && canAdvance && (
            <Pressable accessibilityRole="button" accessibilityLabel="Confirmer la commande" onPress={doConfirm} disabled={busy} style={[styles.commit, busy && styles.commitDisabled]}>
              <Text style={styles.commitLabel}>Confirmer</Text>
            </Pressable>
          )}
          {order.status === 'CONFIRMED' && canAdvance && (
            <Pressable accessibilityRole="button" accessibilityLabel="Préparer la commande" onPress={doPrepare} disabled={busy} style={[styles.commit, busy && styles.commitDisabled]}>
              <Text style={styles.commitLabel}>Préparer</Text>
            </Pressable>
          )}
          {order.status === 'IN_PROGRESS' && canAdvance && (
            <Pressable accessibilityRole="button" accessibilityLabel="Livrer la commande" onPress={doDeliver} disabled={busy} style={[styles.commit, busy && styles.commitDisabled]}>
              <Text style={styles.commitLabel}>Livrer</Text>
            </Pressable>
          )}
          {canCancel && (
            <Pressable accessibilityRole="button" accessibilityLabel="Annuler la commande" onPress={doCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelLabel}>Annuler</Text>
            </Pressable>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[3],
    paddingBottom: tokens.spacing[2],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
  },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  statusText: { ...tokens.typography.bodySm, fontWeight: '700', marginTop: 2 },

  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[8] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[6] },
  client: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  due: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[1] },
  sectionTitle: { ...tokens.typography.headingMd, color: tokens.colors.field.text, marginTop: tokens.spacing[5], marginBottom: tokens.spacing[2] },
  items: { gap: tokens.spacing[2] },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing[3],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  itemLabel: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.text },
  itemMeta: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  itemTotal: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.field.text, fontVariant: ['tabular-nums'] },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: tokens.spacing[4] },
  totalCaption: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  totalVal: { ...tokens.typography.displayMd, color: tokens.colors.primary[600], fontVariant: ['tabular-nums'] },

  footer: {
    flexDirection: 'row',
    gap: tokens.spacing[3],
    alignItems: 'center',
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.spacing[3],
    paddingBottom: tokens.spacing[4],
    borderTopWidth: tokens.layout.ruleWidth,
    borderTopColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  commit: {
    flex: 1,
    minHeight: tokens.touch.primaryButton,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.accent[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  commitDisabled: { opacity: 0.4 },
  commitLabel: { ...tokens.typography.button, fontSize: 16, color: tokens.colors.primary[900] },
  cancelBtn: { minHeight: tokens.touch.primaryButton, borderRadius: tokens.radii.lg, borderWidth: 1, borderColor: tokens.colors.neutral[300], alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing[5] },
  cancelLabel: { ...tokens.typography.button, fontSize: 15, color: tokens.colors.field.textMuted },
});
