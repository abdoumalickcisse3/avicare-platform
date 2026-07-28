/**
 * Daily mortality chart (react-native-svg) — mortality bars over the last
 * entries. Mirrors the web `MortalityChart` (Recharts).
 */
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { tokens } from '@/theme';
import type { PoultryDailyRecord } from '@/types';

const W = 320;
const H = 170;
const PAD = 12;

export function MortalityChart({ records }: { records: PoultryDailyRecord[] }) {
  const bars = useMemo(() => {
    const rows = [...records].sort((a, b) => a.recordDate.localeCompare(b.recordDate)).slice(-14);
    if (rows.length === 0) return null;
    const max = Math.max(1, ...rows.map((r) => r.mortalityCount));
    const slot = (W - 2 * PAD) / rows.length;
    const barW = Math.min(20, slot * 0.6);
    return rows.map((r, i) => ({
      x: PAD + slot * i + slot / 2 - barW / 2,
      barW,
      h: (r.mortalityCount / max) * (H - 2 * PAD),
    }));
  }, [records]);

  if (!bars) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aucune saisie quotidienne.</Text>
      </View>
    );
  }

  const baseY = H - PAD;
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {bars.map((b, i) => (
        <Rect key={i} x={b.x} y={baseY - b.h} width={b.barW} height={b.h} rx={3} fill={tokens.colors.error} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { height: H, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...tokens.typography.bodyMd, color: tokens.colors.field.textMuted, textAlign: 'center' },
});
