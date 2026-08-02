/**
 * Ventes — the sales list, mirroring the web `/commercial/ventes` page (same
 * `getSales`/`cancelSale`). Each row: number, client (or walk-in), articles
 * summary, date, total, status. A completed sale can be cancelled (OWNER/
 * MANAGER — reverses stock). The FAB opens the direct-sale flow, like the web
 * CommercialFab. UX adapted to a mobile card list; logic identical to the web.
 */
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { ArrowLeft, ShoppingCart, X } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { useCancelSaleMutation, useGetSalesQuery } from '@/store/api/salesApi';
import { useGetClientsQuery } from '@/store/api/clientsApi';
import { SALE_STATUS_LABELS, saleStatusColor } from '@/lib/commercial';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { Sale } from '@/types';

function articlesSummary(sale: Sale): string {
  if (sale.items.length === 0) return '—';
  const first = sale.items[0]!;
  const head = `${formatNumber(first.quantity)}× ${first.articleLabelSnapshot ?? first.articleKey}`;
  return sale.items.length > 1 ? `${head} +${sale.items.length - 1}` : head;
}

export default function VentesScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { farmRole } = useFarmAccess();
  const canSell = farmRole === 'OWNER' || farmRole === 'MANAGER';

  const arg = selectedFarmId === null ? skipToken : { farmId: selectedFarmId };
  const { data: sales, isLoading } = useGetSalesQuery(arg);
  const { data: clients } = useGetClientsQuery(arg);
  const [cancelSale] = useCancelSaleMutation();

  if (selectedFarmId === null) {
    return <Redirect href="/(field)" />;
  }

  const clientName = (clientId: number | null) =>
    clientId == null ? 'Client de passage' : (clients?.find((c) => c.id === clientId)?.displayName ?? 'Client');

  const confirmCancel = (sale: Sale) => {
    Alert.alert('Annuler la vente', `Annuler ${sale.saleNumber} ? Le stock sera réintégré.`, [
      { text: 'Retour', style: 'cancel' },
      {
        text: 'Annuler la vente',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelSale({ farmId: selectedFarmId, id: sale.id }).unwrap();
          } catch {
            Alert.alert('Vente', "L'annulation a échoué. Réessayez.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={8} style={styles.backBtn}>
          <ArrowLeft size={22} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Ventes</Text>
          <Text style={styles.subtitle}>Historique des ventes directes</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <Text style={styles.muted}>Chargement…</Text>
        ) : (sales ?? []).length === 0 ? (
          <Text style={styles.muted}>Aucune vente pour le moment.</Text>
        ) : (
          <View style={styles.list}>
            {(sales ?? []).map((s) => (
              <View key={s.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.number}>{s.saleNumber}</Text>
                  <View style={[styles.statusChip, { borderColor: saleStatusColor(s.status) }]}>
                    <Text style={[styles.statusText, { color: saleStatusColor(s.status) }]}>
                      {SALE_STATUS_LABELS[s.status]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.client}>{clientName(s.clientId)}</Text>
                <Text style={styles.articles}>{articlesSummary(s)}</Text>
                <View style={styles.cardBottom}>
                  <Text style={styles.date}>{s.saleDate}</Text>
                  <Text style={styles.total}>{formatCurrency(s.totalXof)}</Text>
                </View>
                {canSell && s.status === 'COMPLETED' && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Annuler ${s.saleNumber}`}
                    onPress={() => confirmCancel(s)}
                    style={styles.cancelBtn}
                  >
                    <X size={14} color={tokens.colors.error} />
                    <Text style={styles.cancelLabel}>Annuler</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {canSell && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nouvelle vente"
          onPress={() => router.push('/(field)/commerce/vente')}
          style={styles.fab}
        >
          <ShoppingCart size={24} color={tokens.colors.primary[900]} />
        </Pressable>
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
  subtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },

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
  articles: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  cardBottom: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: tokens.spacing[1] },
  date: { ...tokens.typography.bodySm, color: tokens.colors.neutral[500] },
  total: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.primary[600], fontVariant: ['tabular-nums'] },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: tokens.spacing[2] },
  cancelLabel: { ...tokens.typography.bodySm, color: tokens.colors.error, fontWeight: '600' },

  fab: {
    position: 'absolute',
    right: tokens.layout.screenPadding,
    bottom: tokens.spacing[6],
    width: 56,
    height: 56,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.accent[400],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.colors.primary[900],
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
