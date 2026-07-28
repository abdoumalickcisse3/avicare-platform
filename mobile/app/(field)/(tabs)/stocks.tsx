/**
 * Stocks tab — the farm inventory, ported from the web `/stocks` overview
 * (same data via `inventoryStockApi`) and reshaped for the field: KPI cards
 * (articles / alertes / valeur), a low-stock highlight section, a search box
 * and the full stock-item list. Read-only for now — movements stay on the web.
 * Shown only to roles with `inventory:read`.
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { AlertTriangle, PackageOpen, Search, Wallet } from 'lucide-react-native';
import { tokens } from '@/theme';
import { AppHeader } from '@/components/AppHeader';
import {
  useGetLowStockItemsQuery,
  useGetStockItemsQuery,
  useGetStockValuationQuery,
} from '@/store/api/inventoryStockApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';
import { formatCurrency, formatNumber, formatRelative } from '@/lib/format';
import type { ArticleSource, StockItem } from '@/types';

const SOURCE_STYLE: Record<ArticleSource, { label: string; bg: string; fg: string }> = {
  INVENTORY: { label: 'Stock', bg: tokens.colors.infoLight, fg: tokens.colors.infoDark },
  TREATMENT: { label: 'Sanitaire', bg: tokens.colors.vetLight, fg: tokens.colors.vetDark },
  PRODUCTION: { label: 'Production', bg: tokens.colors.successLight, fg: tokens.colors.successDark },
};

/** Humanize an article key (`feed_layer` → "Feed layer") — the mobile stock
 * item carries no label snapshot, so we derive a readable name from the key. */
function articleLabel(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isLow(i: StockItem): boolean {
  return i.alertThreshold !== null && i.currentQuantity <= i.alertThreshold;
}

export default function StocksScreen() {
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const [q, setQ] = useState('');

  const arg = selectedFarmId === null ? skipToken : { farmId: selectedFarmId };
  const { data: items, isLoading } = useGetStockItemsQuery(arg);
  const { data: lowStock } = useGetLowStockItemsQuery(arg);
  const { data: valuation } = useGetStockValuationQuery(arg);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = (items ?? []).filter((i) => i.active);
    return needle ? rows.filter((i) => i.articleKey.toLowerCase().includes(needle)) : rows;
  }, [items, q]);

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  const lowCount = lowStock?.length ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Stocks</Text>
        <Text style={styles.subtitle}>Aliments, médicaments et consommables en temps réel.</Text>

        {/* KPI row */}
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <PackageOpen size={18} color={tokens.colors.primary[600]} />
            <Text style={styles.kpiVal}>{formatNumber(items?.length ?? 0)}</Text>
            <Text style={styles.kpiLabel}>Articles</Text>
          </View>
          <View style={[styles.kpi, lowCount > 0 && styles.kpiAlert]}>
            <AlertTriangle size={18} color={lowCount > 0 ? tokens.colors.error : tokens.colors.neutral[400]} />
            <Text style={[styles.kpiVal, lowCount > 0 && { color: tokens.colors.error }]}>{formatNumber(lowCount)}</Text>
            <Text style={styles.kpiLabel}>Alertes</Text>
          </View>
          <View style={styles.kpi}>
            <Wallet size={18} color={tokens.colors.primary[600]} />
            <Text style={styles.kpiVal}>{formatCurrency(valuation?.totalValueXof ?? 0)}</Text>
            <Text style={styles.kpiLabel}>Valeur</Text>
          </View>
        </View>

        {/* Low-stock highlight */}
        {lowStock && lowStock.length > 0 && (
          <View style={styles.lowCard}>
            <View style={styles.lowHead}>
              <AlertTriangle size={16} color={tokens.colors.error} />
              <Text style={styles.lowTitle}>Stock bas — {formatNumber(lowStock.length)}</Text>
            </View>
            {lowStock.map((i) => (
              <View key={i.id} style={styles.lowRow}>
                <Text style={styles.lowName} numberOfLines={1}>{articleLabel(i.articleKey)}</Text>
                <Text style={styles.lowQty}>
                  {formatNumber(i.currentQuantity)}{i.unit ? ` ${i.unit}` : ''}
                  {i.alertThreshold !== null ? (
                    <Text style={styles.lowThreshold}>{`  / seuil ${formatNumber(i.alertThreshold)}`}</Text>
                  ) : null}
                </Text>
              </View>
            ))}
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
            <Text style={styles.emptyText}>Aucun article en stock.</Text>
            <Text style={styles.emptySub}>Le stock se crée à la réception d&apos;un bon d&apos;achat ou via un mouvement (application web).</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((i) => {
              const src = SOURCE_STYLE[i.articleSource];
              const low = isLow(i);
              return (
                <View key={i.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>{articleLabel(i.articleKey)}</Text>
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
                  <View style={styles.cardBottom}>
                    <Text style={[styles.qty, low && { color: tokens.colors.error }]}>
                      {formatNumber(i.currentQuantity)}
                      <Text style={styles.unit}>{i.unit ? ` ${i.unit}` : ''}</Text>
                    </Text>
                    {low && (
                      <View style={styles.lowBadge}>
                        <AlertTriangle size={12} color={tokens.colors.errorDark} />
                        <Text style={styles.lowBadgeText}>Bas</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  content: { paddingHorizontal: tokens.layout.screenPadding, paddingTop: tokens.spacing[2], paddingBottom: tokens.spacing[16] },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[1], marginBottom: tokens.spacing[4] },

  kpiRow: { flexDirection: 'row', gap: tokens.spacing[2], marginBottom: tokens.spacing[4] },
  kpi: { flex: 1, backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200], borderRadius: tokens.radii.lg, padding: tokens.spacing[3], gap: tokens.spacing[1] },
  kpiAlert: { borderColor: tokens.colors.error },
  kpiVal: { ...tokens.typography.numericSm, fontSize: 15, color: tokens.colors.field.text },
  kpiLabel: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted },

  lowCard: { backgroundColor: tokens.colors.errorLight, borderRadius: tokens.radii.xl, padding: tokens.spacing[4], marginBottom: tokens.spacing[4], gap: tokens.spacing[2] },
  lowHead: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  lowTitle: { ...tokens.typography.headingMd, fontSize: 15, color: tokens.colors.errorDark },
  lowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing[3] },
  lowName: { ...tokens.typography.bodySm, fontWeight: '600', color: tokens.colors.field.text, flex: 1 },
  lowQty: { ...tokens.typography.numericSm, fontSize: 13, color: tokens.colors.errorDark },
  lowThreshold: { ...tokens.typography.bodySm, fontWeight: '400', color: tokens.colors.field.textMuted },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], backgroundColor: tokens.colors.neutral[0], borderWidth: 1, borderColor: tokens.colors.neutral[200], borderRadius: tokens.radii.lg, paddingHorizontal: tokens.spacing[3], minHeight: 46, marginBottom: tokens.spacing[3] },
  searchInput: { flex: 1, ...tokens.typography.bodyMd, color: tokens.colors.field.text },

  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[8] },
  emptyBox: { alignItems: 'center', gap: tokens.spacing[2], paddingVertical: tokens.spacing[10] },
  emptyDisc: { width: 60, height: 60, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...tokens.typography.headingMd, color: tokens.colors.field.text },
  emptySub: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, textAlign: 'center', paddingHorizontal: tokens.spacing[6] },

  list: { gap: tokens.spacing[3] },
  card: { backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.xl, borderWidth: 1, borderColor: tokens.colors.neutral[200], padding: tokens.spacing[4], gap: tokens.spacing[3] },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing[3] },
  name: { ...tokens.typography.headingMd, fontSize: 16, color: tokens.colors.field.text },
  meta: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },
  sourceChip: { borderRadius: tokens.radii.full, paddingHorizontal: tokens.spacing[3], paddingVertical: 4 },
  sourceText: { ...tokens.typography.bodySm, fontWeight: '700', fontSize: 11 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qty: { ...tokens.typography.numeric, color: tokens.colors.field.text },
  unit: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted },
  lowBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: tokens.colors.errorLight, borderRadius: tokens.radii.full, paddingHorizontal: tokens.spacing[2], paddingVertical: 3 },
  lowBadgeText: { ...tokens.typography.bodySm, fontWeight: '700', fontSize: 11, color: tokens.colors.errorDark },
});
