"use client";

import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { colors } from "@/theme/tokens";

export interface StatChipProps {
  /** Short descriptor — displayed as a small uppercase label. */
  label: string;
  /** Pre-formatted value string (already through formatCurrency / formatNumber). */
  value: string;
  /**
   * Accent color for the background tint.
   * Must come from `@/theme/tokens` — no hardcoded hex in callers.
   */
  color?: string;
}

/**
 * Compact label + value chip for secondary KPIs inside the bento grid.
 * Pure presentational — token colours only, no fetching.
 */
export function StatChip({ label, value, color = colors.primary[500] }: StatChipProps) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.625,
        borderRadius: 99,
        bgcolor: alpha(color, 0.1),
        border: `1px solid ${alpha(color, 0.2)}`,
        width: "fit-content",
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontWeight: 600,
          fontSize: "0.65rem",
          lineHeight: 1,
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color,
          fontWeight: 700,
          fontSize: "0.8rem",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
