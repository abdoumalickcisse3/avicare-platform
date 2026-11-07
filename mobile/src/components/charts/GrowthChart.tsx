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
  expectedCurve,
  color = tokens.colors.primary[600],
}: {
  data: GrowthPoint[];
  /**
   * Server-computed growth reference (`PoultryBatchResponse.expectedCurve`) — never computed
   * client-side. Empty means the breed's profile carries no validated reference (rustic/local
   * breeds) or the batch has no target: draw no dashed line at all, exactly as the server chose
   * to send nothing. A straight line from (0,0) to a single target once overstated the real
   * weight by roughly double in the first fortnight for a slow-growing breed.
   */
  expectedCurve: GrowthPoint[];
  color?: string;
}) {
  const { line, area, ref, dot } = useMemo(() => {
    if (data.length === 0) return { line: '', area: '', ref: '', dot: null as null | { x: number; y: number } };
    const maxAge = Math.max(...data.map((d) => d.age), ...expectedCurve.map((d) => d.age), 1);
    const maxW = Math.max(...data.map((d) => d.weightG), ...expectedCurve.map((d) => d.weightG), 1);
    const sx = (age: number) => PAD + (age / maxAge) * (W - 2 * PAD);
    const sy = (w: number) => H - PAD - (w / maxW) * (H - 2 * PAD);
    const pts = data.map((d) => ({ x: sx(d.age), y: sy(d.weightG) }));
    const line = smoothPath(pts);
    const last = pts[pts.length - 1]!;
    const area = `${line} L${last.x},${H - PAD} L${pts[0]!.x},${H - PAD} Z`;
    const refPts = expectedCurve
      .slice()
      .sort((a, b) => a.age - b.age)
      .map((p) => ({ x: sx(p.age), y: sy(p.weightG) }));
    const ref = smoothPath(refPts);
    return { line, area, ref, dot: last };
  }, [data, expectedCurve]);

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
