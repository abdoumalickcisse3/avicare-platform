/**
 * Bons d'achat — purchase orders list, mirroring the web `/stocks/achats`
 * (same `getPurchaseOrders`). Number, supplier, status, expected delivery,
 * total. Tap → detail (submit / receive / cancel). FAB creates a new order.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useGetPurchaseOrdersQuery } from '@/store/api/purchaseOrdersApi';
import { PURCHASE_ORDER_STATUS_LABELS, purchaseOrderStatusColor } from '@/lib/commercial';
import { formatCurrency } from '@/lib/format';
import type { PurchaseOrder } from '@/types';

type Filter = 'active' | 'all';

export default function AchatsScreen() {
  const router = useRouter();
  const { can } = useFarmAccess();
  const canWrite = can('inventory:write');
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const [filter, setFilter] = useState<Filter>('active');

  const arg = selectedFarmId === null ? skipToken : { farmId: selectedFarmId };
  const { data: orders, isLoading } = useGetPurchaseOrdersQuery(arg);

  const active = useMemo(
    () => (orders ?? []).filter((o) => o.status === 'DRAFT' || o.status === 'SENT'),
    [orders],
  );
  const rows = filter === 'active' ? active : (orders ?? []);

  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8} style={styles.backBtn}>
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Bons d'achat</Text>
          <Text style={styles.subtitle}>{active.length} en cours</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(['active', 'all'] as const).map((t) => {
          const on = filter === t;
          const label = t === 'active' ? `En cours${active.length ? ` (${active.length})` : ''}` : `Tous${orders?.length ? ` (${orders.length})` : ''}`;
          return (
            <Pressable key={t} onPress={() => setFilter(t)} style={[styles.tab, on && styles.tabOn]} accessibilityRole="button">
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <Text style={styles.muted}>Chargement…</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.muted}>Aucun bon d'achat.</Text>
        ) : (
          <View style={styles.list}>
            {rows.map((o: PurchaseOrder) => (
              <Pressable
                key={o.id}
                accessibilityRole="button"
                accessibilityLabel={`Bon d'achat ${o.orderNumber}`}
                onPress={() => router.push(`/(field)/stocks/achats/${o.id}`)}
                style={styles.card}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.number}>{o.orderNumber}</Text>
                  <View style={[styles.statusChip, { borderColor: purchaseOrderStatusColor(o.status) }]}>
                    <Text style={[styles.statusText, { color: purchaseOrderStatusColor(o.status) }]}>
                      {PURCHASE_ORDER_STATUS_LABELS[o.status]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.supplier}>{o.supplierName}</Text>
                <View style={styles.cardBottom}>
                  <Text style={styles.date}>{o.expectedDeliveryDate ? `Prévu ${o.expectedDeliveryDate}` : '—'}</Text>
                  <Text style={styles.total}>{o.totalXof != null ? formatCurrency(o.totalXof) : '—'}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {canWrite && (
        <Pressable accessibilityRole="button" accessibilityLabel="Nouveau bon d'achat" onPress={() => router.push('/(field)/stocks/achat-nouveau')} style={styles.fab}>
          <Plus size={24} color={tokens.colors.primary[900]} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  header: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3], paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[3], paddingBottom: tokens.spacing[2] },
  backBtn: { width: 40, height: 40, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200] },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },

  tabs: { flexDirection: 'row', gap: tokens.spacing[2], paddingHorizontal: tokens.layout.screenPadding, paddingBottom: tokens.spacing[2] },
  tab: { paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[2], borderRadius: tokens.radii.full, backgroundColor: tokens.colors.neutral[100] },
  tabOn: { backgroundColor: tokens.colors.primary[600] },
  tabText: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.field.textMuted },
  tabTextOn: { color: tokens.colors.neutral[0] },

  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.layout.fabScrollClearance },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[8] },
  list: { gap: tokens.spacing[3] },
  card: { backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.xl, borderWidth: 1, borderColor: tokens.colors.neutral[200], padding: tokens.spacing[4], gap: tokens.spacing[1] },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.field.text },
  statusChip: { borderRadius: tokens.radii.full, borderWidth: 1, paddingHorizontal: tokens.spacing[2], paddingVertical: 1 },
  statusText: { ...tokens.typography.bodySm, fontSize: 10, fontWeight: '700' },
  supplier: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  cardBottom: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: tokens.spacing[1] },
  date: { ...tokens.typography.bodySm, color: tokens.colors.neutral[500] },
  total: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.primary[600], fontVariant: ['tabular-nums'] },

  fab: { position: 'absolute', right: tokens.layout.screenPadding, bottom: tokens.spacing[6], width: 56, height: 56, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.accent[400], alignItems: 'center', justifyContent: 'center', shadowColor: tokens.colors.primary[900], shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
});
