/**
 * Analytique — the farm P&L, mobile port of the web `FarmAnalyticsView`
 * (`financeApi.getFarmAnalytics`), reshaped into a stat-forward, illustrated
 * view: a revenue-vs-dépenses comparison with proportional bars, the revenue
 * split (ventes directes / commandes payées) as a segmented bar, and ranked
 * bar lists for dépenses par catégorie and revenu par lot. Totals are
 * cumulative. Read-only.
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowDownRight, ArrowUpRight, PackageOpen, TrendingUp } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useGetFarmAnalyticsQuery } from '@/store/api/financeApi';
import { formatCurrency } from '@/lib/format';
import type { FarmAnalytics } from '@/types';

function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
}

/** A labelled proportional bar row (label · bar · amount). */
function BarRow({ label, amount, ratio, color }: { label: string; amount: number; ratio: number; color: string }) {
  return (
    <View style={styles.barRow}>
      <View style={styles.barHead}>
        <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.barAmount}>{formatCurrency(amount)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(Math.min(ratio * 100, 100), 2)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function FinanceAnalytics({ farmId }: { farmId: number }) {
  const { data, isLoading } = useGetFarmAnalyticsQuery({ farmId });

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={tokens.colors.primary[600]} />
      </View>
    );
  }
  if (!data) {
    return <Text style={styles.muted}>Aucune donnée financière pour le moment.</Text>;
  }

  const a: FarmAnalytics = data;
  const empty = a.totalRevenueXof === 0 && a.totalExpenseXof === 0;
  const scale = Math.max(a.totalRevenueXof, a.totalExpenseXof, 1);
  const positive = a.marginXof >= 0;
  const marginColor = positive ? tokens.colors.success : tokens.colors.error;
  const marginRatio = a.totalRevenueXof > 0 ? a.marginXof / a.totalRevenueXof : 0;

  const expMax = Math.max(...a.expensesByCategory.map((c) => c.amountXof), 1);
  const unitMax = Math.max(...a.revenueByUnit.map((u) => u.revenueXof), 1);

  return (
    <View style={{ gap: tokens.spacing[4] }}>
      {/* Margin hero */}
      <Animated.View entering={FadeInDown.springify().damping(18)} style={[styles.marginCard, { borderColor: withAlpha(marginColor, 0.35) }]}>
        <View style={styles.marginTop}>
          <View style={[styles.marginIcon, { backgroundColor: withAlpha(marginColor, 0.14) }]}>
            {positive ? <ArrowUpRight size={20} color={marginColor} /> : <ArrowDownRight size={20} color={marginColor} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.marginLabel}>Marge cumulée</Text>
            <Text style={[styles.marginValue, { color: marginColor }]}>{formatCurrency(a.marginXof)}</Text>
          </View>
          {a.totalRevenueXof > 0 && (
            <View style={[styles.marginPctChip, { backgroundColor: withAlpha(marginColor, 0.12) }]}>
              <Text style={[styles.marginPct, { color: marginColor }]}>{(marginRatio * 100).toFixed(0)}%</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Revenue vs expenses comparison */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Revenus vs Dépenses</Text>
        <BarRow label="Revenus" amount={a.totalRevenueXof} ratio={a.totalRevenueXof / scale} color={tokens.colors.primary[500]} />
        <BarRow label="Dépenses" amount={a.totalExpenseXof} ratio={a.totalExpenseXof / scale} color={tokens.colors.accent[500]} />
      </View>

      {/* Revenue split */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Détail du revenu</Text>
        <View style={styles.splitBar}>
          <View style={[styles.splitSeg, { flex: Math.max(a.directSalesXof, 0.001), backgroundColor: tokens.colors.primary[500] }]} />
          <View style={[styles.splitSeg, { flex: Math.max(a.paidOrdersXof, 0.001), backgroundColor: tokens.colors.info }]} />
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: tokens.colors.primary[500] }]} />
            <View>
              <Text style={styles.legendLabel}>Ventes directes</Text>
              <Text style={styles.legendValue}>{formatCurrency(a.directSalesXof)}</Text>
            </View>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: tokens.colors.info }]} />
            <View>
              <Text style={styles.legendLabel}>Commandes payées</Text>
              <Text style={styles.legendValue}>{formatCurrency(a.paidOrdersXof)}</Text>
            </View>
          </View>
        </View>
      </View>

      {empty ? (
        <Text style={styles.muted}>Aucune donnée financière pour le moment.</Text>
      ) : (
        <>
          {/* Expenses by category */}
          <View style={styles.card}>
            <View style={styles.titleRow}>
              <PackageOpen size={16} color={tokens.colors.accent[600]} />
              <Text style={styles.sectionTitle}>Dépenses par catégorie</Text>
            </View>
            {a.expensesByCategory.length === 0 ? (
              <Text style={styles.mutedSmall}>Aucune dépense.</Text>
            ) : (
              <View style={{ gap: tokens.spacing[3], marginTop: tokens.spacing[1] }}>
                {a.expensesByCategory.map((c) => (
                  <BarRow key={c.categoryKey} label={c.label} amount={c.amountXof} ratio={c.amountXof / expMax} color={tokens.colors.accent[500]} />
                ))}
              </View>
            )}
          </View>

          {/* Revenue by unit */}
          <View style={styles.card}>
            <View style={styles.titleRow}>
              <TrendingUp size={16} color={tokens.colors.primary[600]} />
              <Text style={styles.sectionTitle}>Revenu par lot</Text>
            </View>
            {a.revenueByUnit.length === 0 ? (
              <Text style={styles.mutedSmall}>Aucune vente attribuée à un lot.</Text>
            ) : (
              <View style={{ gap: tokens.spacing[3], marginTop: tokens.spacing[1] }}>
                {a.revenueByUnit.map((u) => (
                  <BarRow key={u.unitId} label={u.unitName} amount={u.revenueXof} ratio={u.revenueXof / unitMax} color={tokens.colors.primary[500]} />
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: tokens.spacing[10], alignItems: 'center' },
  muted: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingVertical: tokens.spacing[6] },
  mutedSmall: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, paddingVertical: tokens.spacing[2] },

  marginCard: { backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.xl, borderWidth: 1, padding: tokens.spacing[4] },
  marginTop: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3] },
  marginIcon: { width: 44, height: 44, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center' },
  marginLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  marginValue: { ...tokens.typography.numericSm, fontSize: 26, lineHeight: 32, marginTop: 1 },
  marginPctChip: { borderRadius: tokens.radii.full, paddingHorizontal: tokens.spacing[3], paddingVertical: tokens.spacing[1] },
  marginPct: { ...tokens.typography.headingMd, fontSize: 15, fontWeight: '700' },

  card: { backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.xl, borderWidth: 1, borderColor: tokens.colors.neutral[200], padding: tokens.spacing[4], gap: tokens.spacing[3] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  sectionTitle: { ...tokens.typography.headingMd, fontSize: 15, color: tokens.colors.field.text },

  barRow: { gap: tokens.spacing[1] },
  barHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: tokens.spacing[2] },
  barLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.text, flex: 1 },
  barAmount: { ...tokens.typography.numericSm, fontSize: 14, color: tokens.colors.field.text },
  track: { height: 10, borderRadius: 5, backgroundColor: tokens.colors.neutral[100], overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },

  splitBar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: tokens.colors.neutral[100] },
  splitSeg: { height: 14 },
  legendRow: { flexDirection: 'row', gap: tokens.spacing[4], flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], flex: 1, minWidth: 130 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  legendValue: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.field.text },
});
