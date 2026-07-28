/**
 * Production (7 days) chart (react-native-svg) — eggs collected per closed day,
 * good vs broken stacked. Mirrors the web `Production7dChart` (Recharts).
 */
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Rect } from 'react-native-svg';
import { tokens } from '@/theme';
import type { DailyProduction } from '@/types';

const W = 320;
const H = 180;
const PAD = 12;

export function Production7dChart({ productions }: { productions: DailyProduction[] }) {
  const model = useMemo(() => {
    const days = [...productions].sort((a, b) => a.productionDate.localeCompare(b.productionDate)).slice(-7);
    if (days.length === 0) return null;
    const max = Math.max(1, ...days.map((d) => d.totalEggsCollected + d.totalBrokenEggs));
    const slot = (W - 2 * PAD) / days.length;
    const barW = Math.min(28, slot * 0.6);
    const sy = (v: number) => (v / max) * (H - 2 * PAD);
    return days.map((d, i) => {
      const cx = PAD + slot * i + slot / 2;
      return { x: cx - barW / 2, barW, goodH: sy(d.totalEggsCollected), brokenH: sy(d.totalBrokenEggs) };
    });
  }, [productions]);

  if (!model) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aucune journée clôturée à afficher.</Text>
      </View>
    );
  }

  const baseY = H - PAD;

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {model.map((b, i) => {
        const goodY = baseY - b.goodH;
        const brokenY = goodY - b.brokenH;
        return (
          <G key={i}>
            <Rect x={b.x} y={goodY} width={b.barW} height={b.goodH} fill={tokens.colors.primary[500]} />
            <Rect x={b.x} y={brokenY} width={b.barW} height={b.brokenH} fill={tokens.colors.error} rx={3} />
          </G>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { height: H, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center', paddingHorizontal: tokens.spacing[4] },
});
