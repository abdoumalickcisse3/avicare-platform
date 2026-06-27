"use client";

import type { ReactNode } from "react";
import { Box } from "@mui/material";

export interface BentoGridProps {
  children: ReactNode;
  /** Gap between cells in MUI spacing units (default 2 = 16px). */
  gap?: number;
}

/**
 * Responsive CSS grid container for the dashboard bento layout.
 *
 * Column tracks:
 *   - Mobile  (xs): 1 column
 *   - Tablet  (sm): repeat(6, 1fr)
 *   - Desktop (lg): repeat(12, 1fr)
 *
 * Each child should be a `BentoItem` that declares its own `colSpan`.
 * The grid interleaves widgets from different modules — no per-module grouping.
 *
 * Pure presentational.
 */
export function BentoGrid({ children, gap = 2 }: BentoGridProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gap,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(6, 1fr)",
          lg: "repeat(12, 1fr)",
        },
        alignItems: "start",
      }}
    >
      {children}
    </Box>
  );
}
