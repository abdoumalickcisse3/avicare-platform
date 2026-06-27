"use client";

import { Box, Card, CardContent, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { SparkLineChart } from "@mui/x-charts/SparkLineChart";
import { colors } from "@/theme/tokens";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { HeroTile } from "@/lib/dashboardHero";

export type { HeroTile };

/**
 * StatTile display props — same fields as HeroTile but omits `key` (that
 * field is only needed for React list reconciliation; it is not a component
 * input). Keeping them separate avoids the "key specified twice" TS error
 * when spreading a HeroTile alongside an explicit JSX `key={}` attribute.
 */
export type StatTileProps = Omit<HeroTile, "key">;

/**
 * Hero KPI tile — large formatted value + label + optional sparkline +
 * optional warning colour when `alert=true` and `value > 0`.
 *
 * Pure presentational: receives a HeroTile from pickHeroTiles, no fetching.
 * Colors are sourced exclusively from `@/theme/tokens`.
 */
export function StatTile({ label, value, kind, series, alert }: StatTileProps) {
  const isAlert = alert === true && value > 0;
  const accentColor = isAlert ? colors.warning.main : colors.primary[500];
  const bgColor = isAlert ? colors.warning.light : colors.primary[50];

  const formatted =
    kind === "currency" ? formatCurrency(value) : formatNumber(value);

  const hasSeries = Array.isArray(series) && series.length > 0;

  return (
    <Card
      sx={{
        borderLeft: `3px solid ${accentColor}`,
        bgcolor: "background.paper",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <CardContent sx={{ flex: 1, pb: hasSeries ? 0 : undefined }}>
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            fontWeight: 600,
            fontSize: "0.7rem",
          }}
        >
          {label}
        </Typography>

        <Box
          sx={{
            mt: 0.75,
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          {isAlert && (
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: colors.warning.main,
                flexShrink: 0,
              }}
            />
          )}
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              color: isAlert ? colors.warning.dark : "text.primary",
              lineHeight: 1.15,
            }}
          >
            {formatted}
          </Typography>
        </Box>

        {isAlert && (
          <Box
            sx={{
              mt: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: 1,
              bgcolor: alpha(colors.warning.main, 0.12),
              display: "inline-block",
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: colors.warning.dark, fontWeight: 600, fontSize: "0.7rem" }}
            >
              Requiert attention
            </Typography>
          </Box>
        )}

        {!isAlert && (
          <Box
            sx={{
              mt: 0.5,
              width: 24,
              height: 2,
              borderRadius: 1,
              bgcolor: alpha(accentColor, 0.3),
            }}
          />
        )}
      </CardContent>

      {/* Sparkline — shown only when series data is present */}
      {hasSeries && (
        <Box sx={{ px: 2, pb: 1.5, bgcolor: bgColor, borderBottomLeftRadius: "inherit", borderBottomRightRadius: "inherit" }}>
          <SparkLineChart
            data={series!}
            height={40}
            color={accentColor}
            showTooltip={false}
            showHighlight={false}
            plotType="line"
          />
        </Box>
      )}
    </Card>
  );
}
