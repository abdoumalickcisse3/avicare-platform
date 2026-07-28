/**
 * Cumulative feed chart (react-native-svg) — running total of feed (kg) over
 * time, as a gradient area. Mirrors the web `FeedConsumptionChart` (Recharts).
 */
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { tokens } from '@/theme';
import type { PoultryDailyRecord } from '@/types';

const W = 320;
const H = 170;
const PAD = 12;

export function FeedConsumptionChart({ records }: { records: PoultryDailyRecord[] }) {
  const model = useMemo(() => {
    const rows = [...records].sort((a, b) => a.recordDate.localeCompare(b.recordDate));
    if (rows.length === 0) return null;
    let running = 0;
    const cum = rows.map((r) => (running += Number(r.feedKg) || 0));
    const max = Math.max(1, ...cum);
    const sx = (i: number) => PAD + (rows.length === 1 ? (W - 2 * PAD) / 2 : (i / (rows.length - 1)) * (W - 2 * PAD));
    const sy = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
    const pts = cum.map((v, i) => ({ x: sx(i), y: sy(v) }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const area = `${line} L${pts[pts.length - 1]!.x},${H - PAD} L${pts[0]!.x},${H - PAD} Z`;
    return { line, area };
  }, [records]);

  if (!model) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aucune saisie quotidienne.</Text>
      </View>
    );
  }

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="feedGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tokens.colors.primary[500]} stopOpacity={0.32} />
          <Stop offset="1" stopColor={tokens.colors.primary[500]} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>
      <Path d={model.area} fill="url(#feedGrad)" />
      <Path d={model.line} stroke={tokens.colors.primary[500]} strokeWidth={2.4} fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { height: H, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center' },
});
