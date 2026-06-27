"use client";

import { Box, Card, CardContent, Typography } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { colors } from "@/theme/tokens";
import { formatDate, formatNumber } from "@/lib/format";

/** A single data point — the `valueXof` field is a raw count OR amount (not always money). */
export interface SeriesPoint {
  date: string;
  valueXof: number;
}

export interface ChartWidgetProps {
  /** Chart title. */
  label: string;
  /** Time-series data. Safe when empty — shows `emptyMessage`. */
  series: SeriesPoint[];
  /** "bar" for histogram-style (mortality, etc.); "line" for continuous (CA, eggs). */
  kind?: "bar" | "line";
  /** Y-axis formatter — defaults to formatNumber. */
  yFormatter?: (v: number) => string;
  /** Message to display when series is empty. */
  emptyMessage?: string;
  /** Accent colour for the series bars/line. Must come from `@/theme/tokens`. */
  color?: string;
}

/**
 * Bar or line chart for a single time-series.
 * Pure presentational. Uses @mui/x-charts with token colours.
 * Handles empty data gracefully with an inline message.
 */
export function ChartWidget({
  label,
  series,
  kind = "bar",
  yFormatter = formatNumber,
  emptyMessage = "Aucune donnée pour la période.",
  color = colors.primary[500],
}: ChartWidgetProps) {
  const isEmpty = !series || series.length === 0;

  const dates = isEmpty ? [] : series.map((p) => formatDate(p.date));
  const values = isEmpty ? [] : series.map((p) => p.valueXof);

  const commonAxisProps = {
    xAxis: [
      {
        scaleType: "band" as const,
        data: dates,
        tickLabelStyle: {
          fontSize: 11,
          fill: colors.neutral[500],
        },
      },
    ],
    yAxis: [
      {
        valueFormatter: yFormatter,
        tickLabelStyle: {
          fontSize: 11,
          fill: colors.neutral[500],
        },
      },
    ],
  };

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, mb: 1.5, color: "text.primary" }}
        >
          {label}
        </Typography>

        {isEmpty ? (
          <Box
            sx={{
              height: 180,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {emptyMessage}
            </Typography>
          </Box>
        ) : kind === "bar" ? (
          <BarChart
            {...commonAxisProps}
            series={[
              {
                data: values,
                color,
              },
            ]}
            height={200}
            margin={{ top: 8, right: 8, bottom: 40, left: 48 }}
            grid={{ horizontal: true }}
          />
        ) : (
          <LineChart
            {...commonAxisProps}
            series={[
              {
                data: values,
                color,
                showMark: false,
                area: true,
              },
            ]}
            height={200}
            margin={{ top: 8, right: 8, bottom: 40, left: 48 }}
            grid={{ horizontal: true }}
          />
        )}
      </CardContent>
    </Card>
  );
}
