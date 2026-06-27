"use client";

import { Box } from "@mui/material";
import { StatTile } from "@/components/dashboard/widgets";
import { pickHeroTiles } from "@/lib/dashboardHero";
import type { DashboardResponse } from "@/types/dashboard";

interface HeroKpiRowProps {
  data: DashboardResponse;
}

/**
 * Adaptive hero KPI row — calls pickHeroTiles(data) and renders ≤ 4 StatTiles
 * in a responsive grid: 1 column on mobile, 2 on tablet, 4 on desktop.
 *
 * Each tile sourced from the active modules: CA (commercial), Effectif vivant
 * (livestock), Impayés alert, plus adaptive fallbacks to fill up to 4 tiles.
 * Returns null when no module is active (no tiles to display).
 *
 * Defensive: pickHeroTiles already handles optional / nullable fields via `?? []`.
 * Pure presentational — no fetching, no side effects.
 */
export function HeroKpiRow({ data }: HeroKpiRowProps) {
  const tiles = pickHeroTiles(data);

  if (tiles.length === 0) return null;

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          lg: "repeat(4, 1fr)",
        },
      }}
    >
      {tiles.map(({ key, ...tileProps }) => (
        <StatTile key={key} {...tileProps} />
      ))}
    </Box>
  );
}
