/** Maps a wizard step to its Terroir vivant sky (3 gradient stops) and the
 *  sun's progress along its arc. Pure — drives SkyBackground. See spec §3.
 *
 *  The ambiance stays inside the project design system: only the primary green
 *  ramp and the Senegal-orange accent ramp (+ earth). The "day cycle" reads as
 *  a warm sunrise settling into green, brightening at midday, then a golden hour
 *  sinking into a deep-green dusk — brand-true, not literal sky blues. */
import { tokens } from '@/theme';

export interface Sky {
  stops: [string, string, string];
  sunProgress: number;
}

const { primary, accent, earth } = tokens.colors;

// Sunrise-warm → greening → bright green midday → golden hour → deep-green dusk.
const PALETTE: [string, string, string][] = [
  [accent[200], accent[400], primary[700]], // dawn — warm horizon into green
  [accent[100], accent[300], primary[600]], // sunrise
  [primary[100], primary[300], primary[600]], // morning — greening
  [primary[50], primary[400], primary[700]], // midday — bright green
  [accent[100], primary[400], primary[700]], // afternoon — warm light returns
  [accent[300], accent[500], primary[800]], // golden hour
  [accent[300], primary[700], earth], // dusk — settles to deep green / earth
];

export function skyForStep(index: number, total: number): Sky {
  const last = Math.max(total - 1, 1);
  const clamped = Math.min(Math.max(index, 0), last);
  const paletteIndex = Math.round((clamped / last) * (PALETTE.length - 1));
  const stops = PALETTE[paletteIndex] ?? PALETTE[0]!;
  return { stops, sunProgress: clamped / last };
}
