/**
 * "Bilans de bande" — the farm's closed cycles, side by side. Mirrors the web
 * `ClosedBatchesTable`, as cards rather than a table: a six-column table on a phone is read by
 * nobody.
 *
 * No medal, no overall score. Ranking would mean inventing thresholds, and a threshold that
 * contradicts what a farmer knows of his own trade discredits every other figure on the screen.
 * The reader picks the criterion and draws his own conclusion.
 */
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { AlertTriangle, ArrowLeft } from 'lucide-react-native';
import { tokens } from '@/theme';
import { formatCurrency } from '@/lib/format';
import {
  useGetFarmClosuresQuery,
  type ClosureSummary,
} from '@/store/api/closureListApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';

type SortKey = 'endDate' | 'marginXof' | 'mortalityPercent' | 'feedConversionRatio' | 'costPerKgXof';

const SORTS: Array<{ key: SortKey; label: string; asc: boolean }> = [
  { key: 'endDate', label: 'Plus récentes', asc: false },
  { key: 'marginXof', label: 'Meilleure marge', asc: false },
  { key: 'mortalityPercent', label: 'Moins de pertes', asc: true },
  { key: 'feedConversionRatio', label: 'Meilleur IC', asc: true },
  { key: 'costPerKgXof', label: 'Coût / kg le plus bas', asc: true },
];

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** `2026-08-15` → `15 août 2026`. The mobile has no shared date formatter. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

/** Nulls sink to the bottom: an unknown is not a good score, and not a bad one either. */
function compare(a: ClosureSummary, b: ClosureSummary, key: SortKey, asc: boolean): number {
  const va = a[key];
  const vb = b[key];
  if (va === null || va === undefined) return 1;
  if (vb === null || vb === undefined) return -1;
  const cmp =
    typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
  return asc ? cmp : -cmp;
}

export default function ClosuresScreen() {
  const router = useRouter();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const [sort, setSort] = useState<SortKey>('endDate');

  const { data, isLoading } = useGetFarmClosuresQuery(
    selectedFarmId === null ? skipToken : { farmId: selectedFarmId },
  );

  const rows = useMemo(() => {
    const asc = SORTS.find((s) => s.key === sort)?.asc ?? false;
    return [...(data ?? [])].sort((a, b) => compare(a, b, sort, asc));
  }, [data, sort]);

  if (selectedFarmId === null) return <Redirect href="/(field)" />;

  const anyIncomplete = rows.some((r) => r.valuationIncomplete);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <ArrowLeft size={24} color={tokens.colors.field.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Bilans de bande</Text>
          <Text style={styles.subtitle}>Chaque cycle terminé, figé à sa clôture</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sorts}
      >
        {SORTS.map((s) => {
          const on = sort === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => setSort(s.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Trier par ${s.label}`}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <ActivityIndicator color={tokens.colors.primary[600]} />
        ) : rows.length === 0 ? (
          <Text style={styles.muted}>
            Aucune bande clôturée pour le moment. Le bilan d&apos;une bande apparaît ici dès que
            vous la clôturez.
          </Text>
        ) : (
          <>
            {anyIncomplete && (
              <Text style={styles.warn}>
                Certaines bandes n&apos;ont pas pu être entièrement valorisées : leur coût est
                sous-estimé, et les comparer aux autres les avantage.
              </Text>
            )}

            {rows.map((r) => (
              <Pressable
                key={r.productionUnitId}
                onPress={() => router.push(`/(field)/lots/${r.productionUnitId}`)}
                accessibilityRole="button"
                accessibilityLabel={`Bilan ${r.unitName}`}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {r.unitName}
                      </Text>
                      {r.valuationIncomplete && (
                        <AlertTriangle size={14} color={tokens.colors.warning} />
                      )}
                    </View>
                    <Text style={styles.meta}>
                      {shortDate(r.endDate)} · {r.durationDays} jours
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.margin,
                      { color: r.marginXof >= 0 ? tokens.colors.success : tokens.colors.error },
                    ]}
                  >
                    {formatCurrency(r.marginXof)}
                  </Text>
                </View>

                <View style={styles.metrics}>
                  <Metric
                    label="Mortalité"
                    value={r.mortalityPercent === null ? '—' : `${r.mortalityPercent} %`}
                  />
                  <Metric
                    label="IC"
                    value={r.feedConversionRatio === null ? '—' : String(r.feedConversionRatio)}
                  />
                  <Metric
                    label="Coût / kg"
                    value={r.costPerKgXof === null ? '—' : formatCurrency(r.costPerKgXof)}
                  />
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.spacing[3],
  },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  subtitle: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },

  sorts: {
    paddingHorizontal: tokens.layout.screenPadding,
    gap: tokens.spacing[2],
    paddingBottom: tokens.spacing[3],
  },
  chip: {
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
    borderRadius: tokens.radii.full,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    backgroundColor: tokens.colors.neutral[0],
  },
  chipOn: {
    backgroundColor: tokens.colors.primary[600],
    borderColor: tokens.colors.primary[600],
  },
  chipText: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  chipTextOn: { color: tokens.colors.neutral[0], fontWeight: '700' },

  content: {
    paddingHorizontal: tokens.layout.screenPadding,
    paddingBottom: tokens.spacing[8],
    gap: tokens.spacing[3],
  },
  muted: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, textAlign: 'center' },
  warn: {
    ...tokens.typography.bodySm,
    color: tokens.colors.warningDark,
    backgroundColor: tokens.colors.warningLight,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing[3],
    lineHeight: 20,
  },

  card: {
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    padding: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing[3] },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  name: { ...tokens.typography.headingMd, color: tokens.colors.field.text, flexShrink: 1 },
  meta: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, marginTop: 2 },
  margin: { ...tokens.typography.headingMd, fontVariant: ['tabular-nums'] },

  metrics: { flexDirection: 'row', gap: tokens.spacing[3] },
  metric: { flex: 1, gap: 2 },
  metricLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted },
  metricValue: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.text,
    fontVariant: ['tabular-nums'],
  },
});
