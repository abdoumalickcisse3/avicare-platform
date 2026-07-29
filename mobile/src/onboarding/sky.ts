/** Maps a wizard step to its Terroir vivant sky (3 gradient stops) and the
 *  sun's progress along its arc. Pure — drives SkyBackground. See spec §3. */
export interface Sky {
  stops: [string, string, string];
  sunProgress: number;
}

// Dawn → sunrise → morning → midday → afternoon → golden hour → dusk.
const PALETTE: [string, string, string][] = [
  ['#F9C9B6', '#E88E6B', '#3B3A6B'], // dawn
  ['#FBB871', '#F2864A', '#2E5E8C'], // sunrise
  ['#FFD79A', '#8FC3E8', '#4F9AD1'], // morning
  ['#CFE9FB', '#7FBBE8', '#3E86C4'], // midday
  ['#FFE1A8', '#8FB9E0', '#3D6FA6'], // afternoon
  ['#FFD08A', '#F0975A', '#B65C7A'], // golden hour
  ['#7C5AA6', '#C56C9A', '#241B3A'], // dusk / celebration
];

export function skyForStep(index: number, total: number): Sky {
  const last = Math.max(total - 1, 1);
  const clamped = Math.min(Math.max(index, 0), last);
  const paletteIndex = Math.round((clamped / last) * (PALETTE.length - 1));
  const stops = PALETTE[paletteIndex] ?? PALETTE[0]!;
  return { stops, sunProgress: clamped / last };
}
