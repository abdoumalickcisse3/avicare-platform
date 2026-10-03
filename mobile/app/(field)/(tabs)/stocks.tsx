/**
 * Stocks tab — the farm inventory, ported from the web `/stocks` overview
 * (same data via `inventoryStockApi`) and reshaped for the field: a ticket
 * row (articles / alertes / valeur), a single fused Alertes section (negative
 * stock, low stock, overdue orders — three colored cards used to compete for
 * the same attention), a search box and the full stock-item list. Tapping an
 * article opens its detail (quantity, days of cover, threshold, ledger). Below
 * the list, the web's four quick actions (Bibliothèque, Fournisseurs, Bons
 * d'achat, Formules) — they existed only in the drawer, so a farmer looking at
 * a stock he had just configured had no way to reach his own catalogue.
 * Shown only to roles with `inventory:read`.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import {
  AlertTriangle,
  BookOpen,
  ClipboardList,
  PackageOpen,
  Search,
  Truck,
  Wheat,
  type LucideIcon,
} from 'lucide-react-native';
import { tokens } from '@/theme';
import { AppHeader } from '@/components/AppHeader';
import { QuickAction, SectionHeader, TicketRow } from '@/components/ui';
import {
  useGetInventoryAlertsQuery,
  useGetLowStockItemsQuery,
  useGetStockItemsQuery,
  useGetStockValuationQuery,
} from '@/store/api/inventoryStockApi';
import { useFarmAccess } from '@/auth/useSession';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { formatCurrency, formatNumber, formatRelative } from '@/lib/format';
import type { ArticleSource, StockItem } from '@/types';

const SOURCE_STYLE: Record<ArticleSource, { label: string; bg: string; fg: string }> = {
  INVENTORY: { label: 'Stock', bg: tokens.colors.infoLight, fg: tokens.colors.infoDark },
  TREATMENT: { label: 'Sanitaire', bg: tokens.colors.vetLight, fg: tokens.colors.vetDark },
  PRODUCTION: { label: 'Production', bg: tokens.colors.successLight, fg: tokens.colors.successDark },
};

/** Humanize an article key (`feed_layer` → "Feed layer"). Fallback only: the backend resolves
 * the catalog label, and it is null just for a key the catalog no longer knows. */
function articleLabel(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The web `/stocks` quick actions, same four screens, same order. */
const STOCK_ACTIONS: { label: string; icon: LucideIcon; tint: string; route: string }[] = [
  { label: 'Bibliothèque', icon: BookOpen, tint: tokens.colors.primary[600], route: '/(field)/stocks/bibliotheque' },
  { label: 'Fournisseurs', icon: Truck, tint: tokens.colors.infoDark, route: '/(field)/stocks/fournisseurs' },
  { label: "Bons d'achat", icon: ClipboardList, tint: tokens.colors.accent[400], route: '/(field)/stocks/achats' },
  { label: 'Formules', icon: Wheat, tint: tokens.colors.successDark, route: '/(field)/stocks/formules' },
];

function isLow(i: StockItem): boolean {
  return i.alertThreshold !== null && i.currentQuantity <= i.alertThreshold;
}

export default function StocksScreen() {
  const router = useRouter();
  const { can } = useFarmAccess();
  const canWrite = can('inventory:write');
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const [q, setQ] = useState('');

  const arg = selectedFarmId === null ? skipToken : { farmId: selectedFarmId };
  const { data: items, isLoading } = useGetStockItemsQuery(arg);
  const { data: lowStock } = useGetLowStockItemsQuery(arg);
  const { data: valuation } = useGetStockValuationQuery(arg);
  // Low stock was already shown. The other two the endpoint aggregates were not: an order that
  // never arrived, and — the one that matters most — a count gone below zero, which is not a
  // shortage but a bookkeeping error, and makes every figure derived from that article wrong.
  const { data: alerts } = useGetInventoryAlertsQuery(arg);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = (items ?? []).filter((i) => i.active);
    // Sur le libellé ET sur la clé : la liste porte maintenant tous les articles configurés, et
    // l'éleveur cherche « maïs », pas « mais_concasse ».
    return needle
      ? rows.filter((i) => `${i.label ?? ''} ${i.articleKey}`.toLowerCase().includes(needle))
      : rows;
  }, [items, q]);

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  const negative = alerts?.negativeStockItems ?? [];
  const overdueOrders = alerts?.pendingPurchaseOrders ?? [];

  type AlertRow = { key: string; icon: LucideIcon; tint: string; label: string; value: string };
  const alertRows: AlertRow[] = [
    ...negative.map((i): AlertRow => ({
      key: `neg-${i.stockItemId}`,
      icon: AlertTriangle,
      tint: tokens.colors.error,
      label: i.label ?? i.articleKey,
      value: `${formatNumber(i.currentQuantity)}${i.unit ? ` ${i.unit}` : ''}`,
    })),
    // Low stock and an overdue order both need an action rather than describing something
    // already wrong, so both share the same accent as the band's alert count.
    ...(lowStock ?? []).map((i): AlertRow => ({
      key: `low-${i.id}`,
      icon: AlertTriangle,
      tint: tokens.colors.accent[400],
      label: i.label ?? articleLabel(i.articleKey),
      value: `${formatNumber(i.currentQuantity)}${i.unit ? ` ${i.unit}` : ''}`,
    })),
    ...overdueOrders.map((o): AlertRow => ({
      key: `late-${o.purchaseOrderId}`,
      icon: Truck,
      tint: tokens.colors.accent[400],
      label: `${o.orderNumber} · ${o.supplierName}`,
      value: `${o.daysOverdue} j de retard`,
    })),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Stocks</Text>
        <Text style={styles.subtitle}>Aliments, médicaments et consommables en temps réel.</Text>

        {/* KPI ticket row */}
        <TicketRow
          items={[
            { key: 'articles', value: formatNumber(items?.length ?? 0), label: 'Articles' },
            {
              key: 'alerts',
              value: formatNumber(alertRows.length),
              label: 'Alertes',
              tint: alertRows.length > 0 ? tokens.colors.accent[400] : undefined,
            },
            { key: 'value', value: formatCurrency(valuation?.totalValueXof ?? 0), label: 'Valeur' },
          ]}
        />

        {alertRows.length > 0 && (
          <View style={styles.alertsBlock}>
            <Text style={styles.alertsTitle}>Alertes ({alertRows.length})</Text>
            {alertRows.map((a, i) => {
              const Icon = a.icon;
              return (
                <View key={a.key} style={[styles.alertRow, i > 0 && styles.alertRowBorder]}>
                  <Icon size={16} color={a.tint} />
                  <Text style={styles.alertLabel} numberOfLines={1}>{a.label}</Text>
                  <Text style={[styles.alertValue, { color: a.tint }]}>{a.value}</Text>
                </View>
              );
            })}
            {alertRows.some((a) => a.key.startsWith('neg-')) && (
              <Text style={styles.alertsHint}>
                Un compte sous zéro n&apos;est pas une rupture : c&apos;est une sortie enregistrée deux fois, ou une
                entrée jamais saisie. À corriger par un mouvement d&apos;inventaire.
              </Text>
            )}
          </View>
        )}

        {/* Search */}
        <View style={styles.searchBox}>
          <Search size={18} color={tokens.colors.field.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un article…"
            placeholderTextColor={tokens.colors.field.disabled}
            value={q}
            onChangeText={setQ}
          />
        </View>

        {isLoading ? (
          <Text style={styles.muted}>Chargement…</Text>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyDisc}><PackageOpen size={28} color={tokens.colors.primary[600]} /></View>
            {q.trim() !== '' ? (
              // Une recherche sans résultat n'est pas un stock vide : proposer d'y faire entrer
              // quelque chose serait un contresens.
              <>
                <Text style={styles.emptyText}>Aucun résultat</Text>
                <Text style={styles.emptySub}>Aucun article ne correspond à « {q.trim()} ».</Text>
              </>
            ) : (
              <>
                <Text style={styles.emptyText}>Aucun article en stock.</Text>
                <Text style={styles.emptySub}>
                  Déclarez vos articles dans la Bibliothèque, puis faites-les entrer par un bon
                  d&apos;achat : à la réception, la quantité tombe dans le stock.
                </Text>
                {canWrite && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Créer un bon d'achat"
                    onPress={() => router.push('/(field)/stocks/achat-nouveau')}
                    style={styles.emptyCta}
                  >
                    <Text style={styles.emptyCtaLabel}>Créer un bon d&apos;achat</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((i, idx) => {
              const src = SOURCE_STYLE[i.articleSource];
              const low = isLow(i);
              return (
                <Pressable
                  key={i.id}
                  style={[styles.row, idx > 0 && styles.rowBorder]}
                  // The detail screen, not the movement sheet: consulting a stock — how much is
                  // left, how long it lasts, where it went — is the frequent act. Recording a
                  // movement by hand is a correction, and lives one tap away on that screen.
                  onPress={() => router.push(`/(field)/stocks/${i.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ouvrir ${i.label ?? articleLabel(i.articleKey)}`}
                >
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>{i.label ?? articleLabel(i.articleKey)}</Text>
                      {i.lastMovementAt ? (
                        <Text style={styles.meta}>Dernier mouvement {formatRelative(i.lastMovementAt)}</Text>
                      ) : (
                        <Text style={styles.meta}>Aucun mouvement</Text>
                      )}
                    </View>
                    <View style={[styles.sourceChip, { backgroundColor: src.bg }]}>
                      <Text style={[styles.sourceText, { color: src.fg }]}>{src.label}</Text>
                    </View>
                  </View>
                  <Text style={[styles.qty, low && { color: tokens.colors.accent[400] }]}>
                    {formatNumber(i.currentQuantity)}
                    <Text style={styles.unit}>{i.unit ? ` ${i.unit}` : ''}</Text>
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={styles.qaBlock}>
          <SectionHeader title="Actions rapides" />
          <View style={styles.qaGrid}>
            {STOCK_ACTIONS.map((a) => (
              <View key={a.label} style={styles.qaCell}>
                <QuickAction label={a.label} icon={a.icon} tint={a.tint} onPress={() => router.push(a.route)} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[16] },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[1], marginBottom: tokens.spacing[4] },

  alertsBlock: { marginBottom: tokens.spacing[4] },
  alertsTitle: { ...tokens.typography.bodySm, fontWeight: '700', color: tokens.colors.field.textMuted, marginBottom: tokens.spacing[2] },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], paddingVertical: tokens.spacing[2] },
  alertRowBorder: { borderTopWidth: 1, borderTopColor: tokens.colors.neutral[100] },
  alertLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.text, flex: 1 },
  alertValue: { ...tokens.typography.numericSm, fontSize: 13 },
  alertsHint: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2] },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200], borderRadius: tokens.radii.lg, paddingHorizontal: tokens.spacing[3], minHeight: 46, marginBottom: tokens.spacing[3] },
  searchInput: { flex: 1, ...tokens.typography.bodyMd, color: tokens.colors.field.text },

  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[8] },
  emptyBox: { alignItems: 'center', gap: tokens.spacing[2], paddingVertical: tokens.spacing[10] },
  emptyDisc: { width: 60, height: 60, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  emptySub: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, textAlign: 'center', paddingHorizontal: tokens.spacing[6] },

  emptyCta: { minHeight: tokens.touch.button, borderRadius: tokens.radii.lg, backgroundColor: tokens.colors.accent[400], alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing[5], marginTop: tokens.spacing[2] },
  emptyCtaLabel: { ...tokens.typography.button, fontSize: 15, color: tokens.colors.primary[900] },

  qaBlock: { marginTop: tokens.spacing[6] },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: tokens.spacing[3] },
  qaCell: { width: '48%' },

  list: { gap: tokens.spacing[3] },
  row: { paddingVertical: tokens.spacing[4], gap: tokens.spacing[3] },
  rowBorder: { borderTopWidth: 1, borderTopColor: tokens.colors.neutral[100] },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing[3] },
  name: { ...tokens.typography.headingMd, fontSize: 16, color: tokens.colors.field.text },
  meta: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },
  sourceChip: { borderRadius: tokens.radii.full, paddingHorizontal: tokens.spacing[3], paddingVertical: 4 },
  sourceText: { ...tokens.typography.bodySm, fontWeight: '700', fontSize: 11 },
  qty: { ...tokens.typography.numeric, color: tokens.colors.field.text },
  unit: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
});
