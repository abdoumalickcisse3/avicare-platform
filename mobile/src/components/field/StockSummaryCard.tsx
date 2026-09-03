import { StyleSheet, Text, View } from 'react-native';
import { PackageOpen } from 'lucide-react-native';
import { tokens } from '@/theme';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { InventorySection } from '@/types/dashboard';

/**
 * "Stocks" summary — mirrors the web `InventoryPanel`: what is on hand, what it is worth, and
 * what left over the dashboard period.
 *
 * The value is a floor, not a truth: `typical_unit_price_xof` is nullable, so an article without
 * a price weighs nothing. When some article is unpriced the card says so — a silent
 * understatement always errs in the same direction, making the farm look richer than it is.
 */
export function StockSummaryCard({ data }: { data: InventorySection }) {
  const unpriced = data.totalArticles - data.pricedArticles;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <PackageOpen size={18} color={tokens.colors.accent[600]} />
        <Text style={styles.title}>Stocks</Text>
      </View>

      <View style={styles.row}>
        <Metric label="Valeur" value={formatCurrency(data.stockValueXof)} />
        <Metric
          label="Sous le seuil"
          value={formatNumber(data.lowStockCount)}
          tone={data.lowStockCount > 0 ? tokens.colors.warning : undefined}
        />
      </View>
      <View style={styles.row}>
        <Metric label="Consommé (période)" value={formatCurrency(data.consumedValueXof)} />
        <Metric label="Articles suivis" value={formatNumber(data.totalArticles)} />
      </View>

      {data.valuationIncomplete && (
        <Text style={styles.warn}>
          {unpriced === 1
            ? "1 article n'a pas de prix"
            : `${unpriced} articles n'ont pas de prix`}{' '}
          ({data.pricedArticles}/{data.totalArticles} valorisés). La valeur réelle est plus élevée.
        </Text>
      )}
    </View>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, !!tone && { color: tone }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    padding: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  title: { ...tokens.typography.label, color: tokens.colors.field.text },
  row: { flexDirection: 'row', gap: tokens.spacing[3] },
  metric: { flex: 1, gap: 2 },
  metricLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  metricValue: {
    ...tokens.typography.headingMd,
    color: tokens.colors.field.text,
    fontVariant: ['tabular-nums'],
  },
  warn: {
    ...tokens.typography.bodySm,
    color: tokens.colors.warningDark,
    backgroundColor: tokens.colors.warningLight,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing[3],
    lineHeight: 20,
  },
});
