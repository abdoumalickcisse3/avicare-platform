/**
 * Analytique — the farm P&L, mobile port of the web `FarmAnalyticsView`
 * (`financeApi.getFarmAnalytics`), reshaped into a stat-forward, illustrated
 * view: a coloured margin hero, a Revenus/Dépenses donut with the margin at its
 * centre, the revenue split as a segmented bar, dépenses par catégorie as a
 * vertical bar chart, and revenu par lot as ranked bars. Totals are cumulative.
 * Read-only.
 */
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { ArrowDownRight, ArrowUpRight, PackageOpen, TrendingUp } from 'lucide-react-native';
import { tokens } from '@/theme';
import { useGetFarmAnalyticsQuery } from '@/store/api/financeApi';
import { formatCurrency } from '@/lib/format';
import type { FarmAnalytics } from '@/types';

function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
}

/** Compact money label for tight spaces: 1 250 000 → "1,25 M", 320 000 → "320 k". */
function compactXof(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace('.', ',')} M`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)} k`;
  return String(Math.round(n));
}

const CATEGORY_COLORS = [
  tokens.colors.accent[500],
  tokens.colors.accent[600],
  tokens.colors.warning,
  tokens.colors.clients,
  tokens.colors.info,
  tokens.colors.primary[500],
];

/* ── Revenus / Dépenses donut with margin at the centre ──────────────────── */

const DONUT = 168;
const DONUT_R = 64;
const DONUT_STROKE = 24;
const DONUT_C = 2 * Math.PI * DONUT_R;

function RevExpDonut({ revenue, expense, margin }: { revenue: number; expense: number; margin: number }) {
  const total = revenue + expense || 1;
  const revFrac = revenue / total;
  const expFrac = expense / total;
  const positive = margin >= 0;
  const marginColor = positive ? tokens.colors.success : tokens.colors.error;
  const gap = 2; // px gap between segments, rendered as a dash gap

  const revLen = Math.max(revFrac * DONUT_C - gap, 0);
  const expLen = Math.max(expFrac * DONUT_C - gap, 0);

  return (
    <View style={styles.donutWrap}>
      <View style={styles.donutChart}>
        <Svg width={DONUT} height={DONUT} viewBox={`0 0 ${DONUT} ${DONUT}`}>
          <Circle cx={DONUT / 2} cy={DONUT / 2} r={DONUT_R} stroke={tokens.colors.neutral[100]} strokeWidth={DONUT_STROKE} fill="none" />
          <Circle
            cx={DONUT / 2}
            cy={DONUT / 2}
            r={DONUT_R}
            stroke={tokens.colors.primary[500]}
            strokeWidth={DONUT_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${revLen} ${DONUT_C - revLen}`}
            strokeDashoffset={0}
            transform={`rotate(-90 ${DONUT / 2} ${DONUT / 2})`}
          />
          <Circle
            cx={DONUT / 2}
            cy={DONUT / 2}
            r={DONUT_R}
            stroke={tokens.colors.accent[500]}
            strokeWidth={DONUT_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${expLen} ${DONUT_C - expLen}`}
            strokeDashoffset={-revFrac * DONUT_C}
            transform={`rotate(-90 ${DONUT / 2} ${DONUT / 2})`}
          />
        </Svg>
        <View style={styles.donutCenter} pointerEvents="none">
          <View style={[styles.donutBadge, { backgroundColor: withAlpha(marginColor, 0.14) }]}>
            {positive ? <ArrowUpRight size={14} color={marginColor} /> : <ArrowDownRight size={14} color={marginColor} />}
          </View>
          <Text style={[styles.donutValue, { color: marginColor }]} numberOfLines={1}>{compactXof(margin)}</Text>
          <Text style={styles.donutLabel}>Marge</Text>
        </View>
      </View>

      <View style={styles.donutLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: tokens.colors.primary[500] }]} />
          <View>
            <Text style={styles.legendLabel}>Revenus</Text>
            <Text style={styles.legendValue}>{formatCurrency(revenue)}</Text>
          </View>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: tokens.colors.accent[500] }]} />
          <View>
            <Text style={styles.legendLabel}>Dépenses</Text>
            <Text style={styles.legendValue}>{formatCurrency(expense)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ── Vertical bar chart (dépenses par catégorie) ─────────────────────────── */

const COL_H = 120;

function CategoryColumns({ items }: { items: { categoryKey: string; label: string; amountXof: number }[] }) {
  const max = Math.max(...items.map((i) => i.amountXof), 1);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colRow}>
      {items.map((c, i) => {
        const h = Math.max((c.amountXof / max) * COL_H, 6);
        const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length]!;
        return (
          <View key={c.categoryKey} style={styles.col}>
            <Text style={styles.colValue} numberOfLines={1}>{compactXof(c.amountXof)}</Text>
            <View style={styles.colTrack}>
              <View style={[styles.colBar, { height: h, backgroundColor: color }]} />
            </View>
            <Text style={styles.colLabel} numberOfLines={1}>{c.label}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

/** A labelled proportional bar row (label · bar · amount) — used for revenu par lot. */
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
  const positive = a.marginXof >= 0;
  const marginColor = positive ? tokens.colors.success : tokens.colors.error;
  const marginRatio = a.totalRevenueXof > 0 ? a.marginXof / a.totalRevenueXof : 0;
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

      {/* Revenus vs Dépenses — donut */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Revenus vs Dépenses</Text>
        <RevExpDonut revenue={a.totalRevenueXof} expense={a.totalExpenseXof} margin={a.marginXof} />
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
          {/* Dépenses par catégorie — vertical columns */}
          <View style={styles.card}>
            <View style={styles.titleRow}>
              <PackageOpen size={16} color={tokens.colors.accent[600]} />
              <Text style={styles.sectionTitle}>Dépenses par catégorie</Text>
            </View>
            {a.expensesByCategory.length === 0 ? (
              <Text style={styles.mutedSmall}>Aucune dépense.</Text>
            ) : (
              <CategoryColumns items={a.expensesByCategory} />
            )}
          </View>

          {/* Revenu par lot — ranked bars */}
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

  /* donut */
  donutWrap: { alignItems: 'center', gap: tokens.spacing[3] },
  donutChart: { width: DONUT, height: DONUT, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 1 },
  donutBadge: { width: 28, height: 28, borderRadius: tokens.radii.full, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  donutValue: { ...tokens.typography.numericSm, fontSize: 26, lineHeight: 30 },
  donutLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  donutLegend: { flexDirection: 'row', gap: tokens.spacing[5], justifyContent: 'center', flexWrap: 'wrap' },

  /* vertical columns */
  colRow: { flexDirection: 'row', alignItems: 'flex-end', gap: tokens.spacing[3], paddingTop: tokens.spacing[2], paddingHorizontal: tokens.spacing[1] },
  col: { alignItems: 'center', width: 60, gap: tokens.spacing[1] },
  colValue: { ...tokens.typography.bodySm, fontSize: 11, fontWeight: '700', color: tokens.colors.field.text },
  colTrack: { height: COL_H, justifyContent: 'flex-end' },
  colBar: { width: 34, borderTopLeftRadius: tokens.radii.md, borderTopRightRadius: tokens.radii.md, minHeight: 6 },
  colLabel: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted, maxWidth: 60, textAlign: 'center' },

  /* shared legend */
  legendRow: { flexDirection: 'row', gap: tokens.spacing[4], flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], flex: 1, minWidth: 120 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  legendValue: { ...tokens.typography.bodyMd, fontWeight: '700', color: tokens.colors.field.text },

  /* revenue split bar */
  splitBar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: tokens.colors.neutral[100] },
  splitSeg: { height: 14 },

  /* revenu par lot bars */
  barRow: { gap: tokens.spacing[1] },
  barHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: tokens.spacing[2] },
  barLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.text, flex: 1 },
  barAmount: { ...tokens.typography.numericSm, fontSize: 14, color: tokens.colors.field.text },
  track: { height: 10, borderRadius: 5, backgroundColor: tokens.colors.neutral[100], overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
});
