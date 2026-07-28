/**
 * Flock head-count curve (react-native-svg) — the band's effectif over time,
 * reconstructed from its lifecycle events as a step line. Mirrors the web
 * `FlockCountCurve` (Recharts, stepAfter).
 */
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { tokens } from '@/theme';
import { reconstructFlockCurve } from '@/lib/flock';
import type { LifecycleEvent } from '@/store/api/productionUnitsApi';

const W = 320;
const H = 170;
const PAD = 12;

export function FlockCountCurve({ events }: { events: LifecycleEvent[] }) {
  const path = useMemo(() => {
    const pts = reconstructFlockCurve(events);
    if (pts.length === 0) return null;
    const max = Math.max(1, ...pts.map((p) => p.count));
    const sx = (i: number) => PAD + (pts.length === 1 ? 0 : (i / (pts.length - 1)) * (W - 2 * PAD));
    const sy = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
    // stepAfter: hold the previous y until the next x, then step.
    let d = `M${sx(0)},${sy(pts[0]!.count)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L${sx(i)},${sy(pts[i - 1]!.count)} L${sx(i)},${sy(pts[i]!.count)}`;
    }
    return d;
  }, [events]);

  if (!path) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aucun événement pour tracer l&apos;effectif.</Text>
      </View>
    );
  }

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Path d={path} stroke={tokens.colors.info} strokeWidth={2.4} fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { height: H, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingHorizontal: tokens.spacing[4] },
});
