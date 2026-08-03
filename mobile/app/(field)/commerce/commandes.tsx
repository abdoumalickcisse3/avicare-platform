/**
 * Commandes — the client-orders list, mirroring the web `/commercial/commandes`
 * (same `getOrders`). Each row: number, client, status, expected delivery, total.
 * Tap → the order detail (workflow actions). UX adapted to a mobile card list.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft } from 'lucide-react-native';
import { tokens } from '@/theme';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useGetOrdersQuery } from '@/store/api/ordersApi';
import { useGetClientsQuery } from '@/store/api/clientsApi';
import { ORDER_STATUS_LABELS, orderStatusColor } from '@/lib/commercial';
import { formatCurrency } from '@/lib/format';
import type { Order } from '@/types';

type Filter = 'active' | 'all';

export default function CommandesScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const [filter, setFilter] = useState<Filter>('active');

  const arg = selectedFarmId === null ? skipToken : { farmId: selectedFarmId };
  const { data: orders, isLoading } = useGetOrdersQuery(arg);
  const { data: clients } = useGetClientsQuery(arg);

  const active = useMemo(
    () => (orders ?? []).filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'),
    [orders],
  );
  const rows = filter === 'active' ? active : (orders ?? []);

  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  const clientName = (clientId: number | null) =>
    clientId == null ? 'Client de passage' : (clients?.find((c) => c.id === clientId)?.displayName ?? 'Client');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8} style={styles.backBtn}>
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Commandes</Text>
          <Text style={styles.subtitle}>{active.length} en cours</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(['active', 'all'] as const).map((t) => {
          const on = filter === t;
          const label = t === 'active' ? `En cours${active.length ? ` (${active.length})` : ''}` : `Toutes${orders?.length ? ` (${orders.length})` : ''}`;
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
          <Text style={styles.muted}>Aucune commande.</Text>
        ) : (
          <View style={styles.list}>
            {rows.map((o: Order) => (
              <Pressable
                key={o.id}
                accessibilityRole="button"
                accessibilityLabel={`Commande ${o.orderNumber}`}
                onPress={() => router.push(`/(field)/commerce/commandes/${o.id}`)}
                style={styles.card}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.number}>{o.orderNumber}</Text>
                  <View style={[styles.statusChip, { borderColor: orderStatusColor(o.status) }]}>
                    <Text style={[styles.statusText, { color: orderStatusColor(o.status) }]}>
                      {ORDER_STATUS_LABELS[o.status]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.client}>{clientName(o.clientId)}</Text>
                <View style={styles.cardBottom}>
                  <Text style={styles.date}>{o.expectedDeliveryDate ? `Livraison ${o.expectedDeliveryDate}` : '—'}</Text>
                  <Text style={styles.total}>{formatCurrency(o.totalXof)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
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
  subtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },

  tabs: { flexDirection: 'row', gap: tokens.spacing[2], paddingHorizontal: tokens.layout.screenPadding, paddingBottom: tokens.spacing[2] },
  tab: { paddingHorizontal: tokens.spacing[4], paddingVertical: tokens.spacing[2], borderRadius: tokens.radii.full, backgroundColor: tokens.colors.neutral[100] },
  tabOn: { backgroundColor: tokens.colors.primary[600] },
  tabText: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.field.textMuted },
  tabTextOn: { color: tokens.colors.neutral[0] },

  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[16] },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[8] },
  list: { gap: tokens.spacing[3] },
  card: {
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.xl,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    padding: tokens.spacing[4],
    gap: tokens.spacing[1],
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.field.text },
  statusChip: { borderRadius: tokens.radii.full, borderWidth: 1, paddingHorizontal: tokens.spacing[2], paddingVertical: 1 },
  statusText: { ...tokens.typography.bodySm, fontSize: 10, fontWeight: '700' },
  client: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  cardBottom: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: tokens.spacing[1] },
  date: { ...tokens.typography.bodySm, color: tokens.colors.neutral[500] },
  total: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.primary[600], fontVariant: ['tabular-nums'] },
});
