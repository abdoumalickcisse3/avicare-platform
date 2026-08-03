/**
 * Factures — the invoices list, mirroring the web `/commercial/factures` page
 * (same `getInvoices`). Filter Toutes / Impayées; each row: number, client,
 * total, encaissé, reste (colored), status. Tap → the invoice detail (where a
 * payment can be recorded). UX adapted to a mobile card list.
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
import { useGetInvoicesQuery } from '@/store/api/invoicesApi';
import { useGetClientsQuery } from '@/store/api/clientsApi';
import { GenerateInvoiceSheet } from '@/commerce/GenerateInvoiceSheet';
import { INVOICE_STATUS_LABELS, invoiceStatusColor } from '@/lib/commercial';
import { formatCurrency } from '@/lib/format';
import type { Invoice } from '@/types';

type Filter = 'all' | 'unpaid';

export default function FacturesScreen() {
  const router = useRouter();
  const { farmRole } = useFarmAccess();
  const canGenerate = farmRole === 'OWNER' || farmRole === 'MANAGER';
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const [filter, setFilter] = useState<Filter>('all');
  const [sheetOpen, setSheetOpen] = useState(false);

  const arg = selectedFarmId === null ? skipToken : { farmId: selectedFarmId };
  const { data: invoices, isLoading } = useGetInvoicesQuery(arg);
  const { data: clients } = useGetClientsQuery(arg);

  const unpaid = useMemo(
    () => (invoices ?? []).filter((i) => i.status === 'ISSUED' || i.status === 'PARTIALLY_PAID'),
    [invoices],
  );
  const rows = filter === 'unpaid' ? unpaid : (invoices ?? []);

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
          <Text style={styles.title}>Factures</Text>
          <Text style={styles.subtitle}>{unpaid.length} impayée(s)</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(['all', 'unpaid'] as const).map((t) => {
          const on = filter === t;
          const label = t === 'all' ? `Toutes${invoices?.length ? ` (${invoices.length})` : ''}` : `Impayées${unpaid.length ? ` (${unpaid.length})` : ''}`;
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
          <Text style={styles.muted}>Aucune facture.</Text>
        ) : (
          <View style={styles.list}>
            {rows.map((inv: Invoice) => (
              <Pressable
                key={inv.id}
                accessibilityRole="button"
                accessibilityLabel={`Facture ${inv.invoiceNumber}`}
                onPress={() => router.push(`/(field)/commerce/factures/${inv.id}`)}
                style={styles.card}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.number}>{inv.invoiceNumber}</Text>
                  <View style={[styles.statusChip, { borderColor: invoiceStatusColor(inv.status) }]}>
                    <Text style={[styles.statusText, { color: invoiceStatusColor(inv.status) }]}>
                      {INVOICE_STATUS_LABELS[inv.status]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.client}>{clientName(inv.clientId)}</Text>
                <View style={styles.amounts}>
                  <View>
                    <Text style={styles.amountCaption}>Total</Text>
                    <Text style={styles.amountVal}>{formatCurrency(inv.totalXof)}</Text>
                  </View>
                  <View>
                    <Text style={styles.amountCaption}>Reste</Text>
                    <Text style={[styles.amountVal, { color: inv.outstandingXof > 0 ? tokens.colors.error : tokens.colors.success }]}>
                      {formatCurrency(inv.outstandingXof)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {canGenerate && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Générer une facture"
          onPress={() => setSheetOpen(true)}
          style={styles.fab}
        >
          <Plus size={24} color={tokens.colors.primary[900]} />
        </Pressable>
      )}

      {sheetOpen && selectedFarmId !== null && (
        <GenerateInvoiceSheet
          farmId={selectedFarmId}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onDone={() => setSheetOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
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
    gap: tokens.spacing[2],
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.field.text },
  statusChip: { borderRadius: tokens.radii.full, borderWidth: 1, paddingHorizontal: tokens.spacing[2], paddingVertical: 1 },
  statusText: { ...tokens.typography.bodySm, fontSize: 10, fontWeight: '700' },
  client: { ...tokens.typography.bodyMd, color: tokens.colors.field.text },
  amounts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: tokens.spacing[1] },
  amountCaption: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  amountVal: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.field.text, fontVariant: ['tabular-nums'] },
});
