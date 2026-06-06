/**
 * Design tokens — single source of truth for the palette, spacing, radii and
 * shadows defined in docs/10-design-system.md. The MUI theme (index.ts) and any
 * ad-hoc `sx` styling must read from here, never hardcode hex values.
 */

export const colors = {
  primary: {
    50: "#F0F7F0",
    100: "#DCEEDC",
    200: "#B8DDB8",
    300: "#8BC68B",
    400: "#5EAA5E",
    500: "#3D8B3D", // main
    600: "#2E6B2E",
    700: "#245524",
    800: "#1B3F1B",
    900: "#122B12",
  },
  accent: {
    50: "#FFF4E6",
    100: "#FFE1B8",
    200: "#FFCB85",
    300: "#FFB04D",
    400: "#F8961E", // main accent (orange Sénégal)
    500: "#E67E0A",
    600: "#C46505",
    700: "#9C4F03",
    800: "#7A3D02",
    900: "#5A2C01",
  },
  success: { main: "#16A34A", light: "#DCFCE7", dark: "#14532D" },
  warning: { main: "#D97706", light: "#FEF3C7", dark: "#78350F" },
  error: { main: "#DC2626", light: "#FEE2E2", dark: "#7F1D1D" },
  info: { main: "#2563EB", light: "#DBEAFE", dark: "#1E3A8A" },
  neutral: {
    0: "#FFFFFF",
    50: "#FAFAF9", // app background (warm)
    100: "#F5F5F4",
    200: "#E7E5E4", // subtle borders
    300: "#D6D3D1",
    400: "#A8A29E",
    500: "#78716C", // secondary text
    600: "#57534E",
    700: "#44403C",
    800: "#292524", // primary text
    900: "#1C1917",
    950: "#0C0A09",
  },
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 24,
  full: 9999,
} as const;

export const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
  focus: "0 0 0 3px #DCEEDC",
} as const;
