/**
 * Growth chart (react-native-svg) — average weight vs age, with an optional
 * dashed target reference line. Used on the broiler lot-detail "Vue
 * d'ensemble" tab (Stitch reference). No chart library: a smooth SVG path with
 * a gradient area fill, drawn from the weighing samples.
 */
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { tokens } from '@/theme';

export interface GrowthPoint {
  age: number;
  weightG: number;
}

const W = 320;
const H = 170;
const PAD = 10;

function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return '';
  const first = pts[0]!;
  let d = `M${first.x},${first.y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1]!;
    const p1 = pts[i]!;
    const xm = (p0.x + p1.x) / 2;
    d += ` C${xm},${p0.y} ${xm},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}

export function GrowthChart({
  data,
  target,
  color = tokens.colors.primary[600],
}: {
  data: GrowthPoint[];
  /** Optional target: reference line from (0,0) to (targetAge, targetWeightG). */
  target?: { age: number; weightG: number } | null;
  color?: string;
}) {
  const { line, area, ref, dot } = useMemo(() => {
    if (data.length === 0) return { line: '', area: '', ref: '', dot: null as null | { x: number; y: number } };
    const maxAge = Math.max(target?.age ?? 0, ...data.map((d) => d.age), 1);
    const maxW = Math.max(target?.weightG ?? 0, ...data.map((d) => d.weightG), 1);
    const sx = (age: number) => PAD + (age / maxAge) * (W - 2 * PAD);
    const sy = (w: number) => H - PAD - (w / maxW) * (H - 2 * PAD);
    const pts = data.map((d) => ({ x: sx(d.age), y: sy(d.weightG) }));
    const line = smoothPath(pts);
    const last = pts[pts.length - 1]!;
    const area = `${line} L${last.x},${H - PAD} L${pts[0]!.x},${H - PAD} Z`;
    const ref = target ? `M${sx(0)},${sy(0)} L${sx(target.age)},${sy(target.weightG)}` : '';
    return { line, area, ref, dot: last };
  }, [data, target]);

  if (data.length < 2) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Pas encore assez de pesées pour tracer la courbe.</Text>
      </View>
    );
  }

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>
      {ref ? <Path d={ref} stroke={tokens.colors.neutral[400]} strokeWidth={1.5} strokeDasharray="4 4" fill="none" /> : null}
      <Path d={area} fill="url(#growthGrad)" />
      <Path d={line} stroke={color} strokeWidth={2.6} fill="none" />
      {dot ? <Circle cx={dot.x} cy={dot.y} r={4} fill={color} /> : null}
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { height: H, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingHorizontal: tokens.spacing[4] },
});
