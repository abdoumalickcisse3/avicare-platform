/**
 * Grades distribution donut (react-native-svg) + legend — the egg-calibre
 * split for a day. Mirrors the web `GradesDistributionChart` (Recharts) using
 * the stroke-dasharray circle technique instead of a chart library.
 */
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { tokens } from '@/theme';
import { sortGradeKeys } from '@/lib/layer';
import { formatNumber } from '@/lib/format';

const SLICE_COLORS = [
  tokens.colors.primary[500],
  tokens.colors.accent[400],
  tokens.colors.info,
  tokens.colors.success,
  tokens.colors.primary[300],
  tokens.colors.accent[600],
];

const SIZE = 120;
const R = 46;
const STROKE = 20;
const C = 2 * Math.PI * R;

export function GradesDonut({ gradesCount }: { gradesCount: Record<string, number> }) {
  const { slices, total } = useMemo(() => {
    const keys = sortGradeKeys(Object.keys(gradesCount)).filter((k) => (gradesCount[k] ?? 0) > 0);
    const total = keys.reduce((s, k) => s + (gradesCount[k] ?? 0), 0);
    let acc = 0;
    const slices = keys.map((k, i) => {
      const value = gradesCount[k] ?? 0;
      const frac = total === 0 ? 0 : value / total;
      const seg = { key: k, value, color: SLICE_COLORS[i % SLICE_COLORS.length]!, len: frac * C, offset: acc * C };
      acc += frac;
      return seg;
    });
    return { slices, total };
  }, [gradesCount]);

  if (total === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aucune répartition par calibre.</Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={tokens.colors.neutral[100]} strokeWidth={STROKE} fill="none" />
        {slices.map((s) => (
          <Circle
            key={s.key}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={s.color}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${s.len} ${C - s.len}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        ))}
      </Svg>
      <View style={styles.legend}>
        {slices.map((s) => (
          <View key={s.key} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>Calibre {s.key}</Text>
            <Text style={styles.legendVal}>{formatNumber(s.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[4] },
  legend: { flex: 1, gap: tokens.spacing[1] },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  dot: { width: 12, height: 12, borderRadius: 3 },
  legendLabel: { ...tokens.typography.bodySm, color: tokens.colors.field.text, flex: 1 },
  legendVal: { ...tokens.typography.numericSm, fontSize: 13, color: tokens.colors.field.text },
  empty: { height: 120, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center' },
});
