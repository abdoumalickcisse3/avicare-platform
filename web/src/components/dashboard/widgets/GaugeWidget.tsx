"use client";

import { Card, CardContent, Typography } from "@mui/material";
import { Gauge, gaugeClasses } from "@mui/x-charts/Gauge";
import { colors } from "@/theme/tokens";

export interface GaugeWidgetProps {
  /** Rate value 0–100 (%). */
  value: number;
  /** Label displayed below the gauge. */
  label: string;
  /**
   * Accent color for the filled arc.
   * Must come from `@/theme/tokens` — no hardcoded hex in callers.
   */
  color?: string;
}

/**
 * Gauge widget for 0–100 rates (mortality rate, laying rate, etc.).
 * Pure presentational. Uses @mui/x-charts Gauge with token colours.
 */
export function GaugeWidget({ value, label, color = colors.primary[500] }: GaugeWidgetProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          pt: 2,
        }}
      >
        <Gauge
          value={clamped}
          startAngle={-110}
          endAngle={110}
          width={140}
          height={100}
          text={`${clamped} %`}
          sx={{
            [`& .${gaugeClasses.valueArc}`]: { fill: color },
            [`& .${gaugeClasses.referenceArc}`]: { fill: colors.neutral[200] },
            [`& .${gaugeClasses.valueText}`]: {
              fontSize: 20,
              fontWeight: 700,
              fill: colors.neutral[800],
            },
          }}
        />
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            fontWeight: 600,
            fontSize: "0.7rem",
            textAlign: "center",
          }}
        >
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}
