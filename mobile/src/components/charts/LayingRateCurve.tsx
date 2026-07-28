/**
 * Laying-rate curve (react-native-svg) — real laying rate (%) per closed day
 * vs the peak-target reference line. Mirrors the web `LayingRateCurve`
 * (Recharts) without a chart library. Y axis fixed to 0–100 %.
 */
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { tokens } from '@/theme';
import { TARGET_LAYING_RATE_PCT } from '@/lib/layer';
import type { DailyProduction } from '@/types';

const W = 320;
const H = 180;
const PAD = 12;

export function LayingRateCurve({ productions }: { productions: DailyProduction[] }) {
  const model = useMemo(() => {
    const withRate = [...productions]
      .filter((p) => p.layingRatePct != null)
      .sort((a, b) => a.productionDate.localeCompare(b.productionDate));
    if (withRate.length === 0) return null;
    const sx = (i: number) => PAD + (withRate.length === 1 ? (W - 2 * PAD) / 2 : (i / (withRate.length - 1)) * (W - 2 * PAD));
    const sy = (pct: number) => H - PAD - (Math.max(0, Math.min(100, pct)) / 100) * (H - 2 * PAD);
    const pts = withRate.map((p, i) => ({ x: sx(i), y: sy(Number(p.layingRatePct)), label: p.productionDate.slice(5) }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    return { pts, line, targetY: sy(TARGET_LAYING_RATE_PCT) };
  }, [productions]);

  if (!model) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Clôturez une journée pour afficher le taux de ponte.</Text>
      </View>
    );
  }

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {/* target reference line */}
      <Line x1={PAD} y1={model.targetY} x2={W - PAD} y2={model.targetY} stroke={tokens.colors.accent[400]} strokeWidth={1.5} strokeDasharray="5 5" />
      <Path d={model.line} stroke={tokens.colors.success} strokeWidth={2.6} fill="none" />
      {model.pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3} fill={tokens.colors.success} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { height: H, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingHorizontal: tokens.spacing[4] },
});
