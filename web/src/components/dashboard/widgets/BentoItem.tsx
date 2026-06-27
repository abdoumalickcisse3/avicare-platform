"use client";

import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

/** Module identity shown as an eyebrow above the widget. */
export interface ModuleAccent {
  /** Module display name: "COMMERCIAL" | "ÉLEVAGE" | "STOCKS". */
  label: string;
  /** Accent colour from `@/theme/tokens` — no hardcoded hex. */
  color: string;
}

export interface BentoItemProps {
  children: ReactNode;
  /**
   * Column span within the bento grid (1–12 on desktop, 1–6 on tablet).
   * Defaults to 6 (half of the 12-column desktop grid).
   */
  colSpan?: number;
  /**
   * Row span (optional — most widgets are 1 row tall).
   */
  rowSpan?: number;
  /** When provided, renders a coloured eyebrow label identifying the module. */
  accent?: ModuleAccent;
}

/**
 * Single cell in the BentoGrid. Handles:
 * - Grid placement via `colSpan` / `rowSpan`
 * - Optional module eyebrow (colour pill + label)
 * - Passes children through unchanged
 *
 * Pure presentational — token colours only.
 */
export function BentoItem({
  children,
  colSpan = 6,
  rowSpan = 1,
  accent,
}: BentoItemProps) {
  return (
    <Box
      sx={{
        gridColumn: {
          xs: "1 / -1",
          sm: `span ${Math.min(colSpan, 6)}`,
          lg: `span ${colSpan}`,
        },
        gridRow: rowSpan > 1 ? `span ${rowSpan}` : undefined,
        display: "flex",
        flexDirection: "column",
        gap: accent ? 0.75 : 0,
        minWidth: 0,
      }}
    >
      {accent && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          {/* Colour pill */}
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: accent.color,
              flexShrink: 0,
            }}
          />
          <Typography
            variant="caption"
            sx={{
              color: accent.color,
              fontWeight: 700,
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              bgcolor: alpha(accent.color, 0.1),
              px: 0.75,
              py: 0.25,
              borderRadius: 0.5,
              lineHeight: 1.6,
            }}
          >
            {accent.label}
          </Typography>
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Box>
  );
}
