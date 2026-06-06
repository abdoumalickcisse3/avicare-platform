"use client";

import { createTheme } from "@mui/material/styles";
import { colors, radii, shadows } from "./tokens";

/**
 * avicareTheme — MUI v7 theme implementing docs/10-design-system.md §7.
 * Green primary / orange-Sénégal accent, Inter typography, custom component
 * overrides so the app never looks like generic Material Design. The primary
 * CTA is orange (containedPrimary), buttons are not uppercased, cards use 12px
 * radius with subtle borders instead of MUI elevation shadows.
 */
export const avicareTheme = createTheme({
  cssVariables: true,
  breakpoints: {
    values: { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 },
  },
  palette: {
    mode: "light",
    primary: {
      ...colors.primary,
      main: colors.primary[500],
      contrastText: colors.neutral[0],
    },
    secondary: {
      ...colors.accent,
      main: colors.accent[400],
      contrastText: colors.neutral[0],
    },
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    background: {
      default: colors.neutral[50],
      paper: colors.neutral[0],
    },
    text: {
      primary: colors.neutral[800],
      secondary: colors.neutral[500],
    },
    divider: colors.neutral[200],
  },
  typography: {
    fontFamily: 'var(--font-sans), "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    h1: { fontSize: "3rem", fontWeight: 700, lineHeight: 1.1 },
    h2: { fontSize: "2.25rem", fontWeight: 700, lineHeight: 1.15 },
    h3: { fontSize: "1.875rem", fontWeight: 600, lineHeight: 1.2 },
    h4: { fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.25 },
    h5: { fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.3 },
    h6: { fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.3 },
    body1: { fontSize: "1rem", lineHeight: 1.5 },
    body2: { fontSize: "0.875rem", lineHeight: 1.5 },
    caption: { fontSize: "0.8125rem", lineHeight: 1.4 },
    button: { textTransform: "none", fontWeight: 500 },
  },
  shape: {
    borderRadius: radii.md,
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: radii.md,
          textTransform: "none",
          fontWeight: 500,
          padding: "8px 16px",
        },
      },
      variants: [
        {
          // Primary CTA = orange accent (doc 10 §6), not the green palette.
          props: { variant: "contained", color: "primary" },
          style: {
            backgroundColor: colors.accent[400],
            "&:hover": { backgroundColor: colors.accent[500] },
          },
        },
      ],
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: radii.lg,
          border: `1px solid ${colors.neutral[200]}`,
          boxShadow: "none",
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined", size: "small" },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: colors.neutral[50],
          "& .MuiTableCell-head": {
            fontWeight: 600,
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: colors.neutral[500],
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
  },
});

export { colors, radii, shadows };
