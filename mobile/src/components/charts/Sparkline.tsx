/**
 * Sparkline — a tiny area+line chart for a numeric series, used across the home
 * hero and KPI tiles. Pure SVG (react-native-svg), no axes/labels: it reads as
 * a trend, not a chart. Renders nothing meaningful below 2 points (a flat
 * baseline), so callers can pass it unconditionally.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

export function Sparkline({
  data,
  color,
  width = 120,
  height = 40,
  strokeWidth = 2,
  fillOpacity = 0.18,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  fillOpacity?: number;
}) {
  const gradId = useMemo(() => `spark-${Math.random().toString(36).slice(2, 8)}`, []);

  const { line, area } = useMemo(() => {
    const pts = data.length >= 2 ? data : [data[0] ?? 0, data[0] ?? 0];
    const n = pts.length;
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const span = max - min || 1;
    const pad = strokeWidth + 1;
    const w = width;
    const h = height;
    const x = (i: number) => (n === 1 ? w / 2 : (i / (n - 1)) * w);
    const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);

    let d = `M ${x(0).toFixed(1)} ${y(pts[0]!).toFixed(1)}`;
    for (let i = 1; i < n; i++) d += ` L ${x(i).toFixed(1)} ${y(pts[i]!).toFixed(1)}`;
    const areaD = `${d} L ${w.toFixed(1)} ${h} L 0 ${h} Z`;
    return { line: d, area: areaD };
  }, [data, width, height, strokeWidth]);

  return (
    <View pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={fillOpacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill={`url(#${gradId})`} />
        <Path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    </View>
  );
}
