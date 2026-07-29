/**
 * "Terroir vivant" sky background — full-bleed SVG gradient sky whose colors
 * and sun position track the current onboarding wizard step, with content
 * layered on top. Colors and sun progress come from `skyForStep` (pure, see
 * `@/onboarding/sky`); rendering here is a plain re-render on step change —
 * simple and test-safe under the reanimated mock (spec §3, task 8).
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { skyForStep } from '@/onboarding/sky';
import { tokens } from '@/theme';

export function SkyBackground({
  stepIndex,
  total,
  children,
}: {
  stepIndex: number;
  total: number;
  children?: ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const { stops, sunProgress } = skyForStep(stepIndex, total);

  // Sun rises left-to-right along a gentle arc: highest at mid-journey.
  const sunX = width * (0.15 + 0.7 * sunProgress);
  const sunY = height * (0.28 - 0.14 * Math.sin(Math.PI * sunProgress));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stops[0]} />
            <Stop offset="0.5" stopColor={stops[1]} />
            <Stop offset="1" stopColor={stops[2]} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#sky)" />
        <Circle cx={sunX} cy={sunY} r={46} fill={tokens.colors.accent[100]} opacity={0.35} />
        <Circle cx={sunX} cy={sunY} r={30} fill={tokens.colors.accent[200]} />
      </Svg>
      <View style={StyleSheet.absoluteFill}>{children}</View>
    </View>
  );
}
