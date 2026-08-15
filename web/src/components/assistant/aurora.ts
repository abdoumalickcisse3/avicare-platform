/**
 * Light-glassmorphism identity for Jawdi IA: a soft, luminous frosted surface
 * with the Jawdi green + orange brand. Translucent white glass panels over a
 * pale green-tinted base, with gentle colored halos for depth. Self-contained
 * (not read from the light MUI theme) so the advisor page keeps one cohesive
 * look. Fonts reuse the app's global next/font variables (Outfit + JetBrains
 * Mono).
 */
export const aurora = {
  // Pale, green-tinted frosted base.
  bg: "#eef3ea",
  bgTint: "#e4efe1",
  // Translucent white glass surfaces.
  glass: "rgba(255,255,255,0.55)",
  glassStrong: "rgba(255,255,255,0.82)",
  border: "rgba(255,255,255,0.75)",
  borderSoft: "rgba(28,54,32,0.10)",
  // Text.
  onSurface: "#17301c",
  onVariant: "rgba(23,48,28,0.60)",
  // Brand.
  primary: "#3d8b3d",
  primaryDeep: "#245524",
  onPrimary: "#ffffff",
  secondary: "#f8961e",
  amber: "#c46505",
  danger: "#dc2626",
  sans: "var(--font-sans)",
  mono: "var(--font-mono)",
} as const;

import type { CSSObject } from "@mui/material/styles";

/** A light-glass surface: frosted white fill, soft light-catching border + shadow, backdrop blur. */
export const glass = (radius = 20): CSSObject => ({
  background: aurora.glass,
  border: `1px solid ${aurora.border}`,
  borderRadius: `${radius}px`,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow: "0 8px 32px rgba(28,60,35,0.10)",
});
