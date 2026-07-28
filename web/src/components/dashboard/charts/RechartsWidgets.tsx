"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Box, Typography } from "@mui/material";
import { colors } from "@/theme/tokens";
import { formatDate, formatNumber } from "@/lib/format";

/** Shared point shape used across the dashboard series. */
export interface Point {
  date: string;
  valueXof: number;
}

const AXIS = colors.neutral[400];
const GRID = colors.neutral[100];

/** Styled tooltip card — one value, formatted by the caller. */
function ChartTooltip({
  active,
  payload,
  label,
  format,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string | number;
  format: (v: number) => string;
  unit?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const raw = payload[0]?.value;
  const v = typeof raw === "number" ? raw : Number(raw);
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: 1.5,
        px: 1.25,
        py: 0.75,
        boxShadow: "0 4px 16px rgba(28,25,23,.10)",
      }}
    >
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {Number.isFinite(v) ? format(v) : "—"}
        {unit ? ` ${unit}` : ""}
      </Typography>
    </Box>
  );
}

/**
 * Fluid area trend chart (Recharts) — gradient fill, smooth monotone curve,
 * faint grid, hover tooltip. The main dashboard time-series visual.
 */
export function AreaTrend({
  data,
  color = colors.primary[500],
  height = 260,
  format = formatNumber,
  unit,
}: {
  data: Point[];
  color?: string;
  height?: number;
  format?: (v: number) => string;
  unit?: string;
}) {
  const gid = useId().replace(/:/g, "");
  const rows = data.map((p) => ({ label: formatDate(p.date), value: p.valueXof }));

  if (rows.length === 0) {
    return (
      <Box sx={{ height, display: "grid", placeItems: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Aucune donnée pour la période.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
          <YAxis
            tick={{ fontSize: 11, fill: AXIS }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => formatNumber(v as number)}
          />
          <Tooltip content={<ChartTooltip format={format} unit={unit} />} cursor={{ stroke: color, strokeOpacity: 0.25 }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.4}
            fill={`url(#grad-${gid})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}

/** Tiny inline sparkline for stat cards — no axes, just a smooth gradient area. */
export function Sparkline({ data, color = colors.primary[500], height = 34 }: { data: number[]; color?: string; height?: number }) {
  const gid = useId().replace(/:/g, "");
  if (!data || data.length < 2) return null;
  const rows = data.map((v, i) => ({ i, value: v }));
  return (
    <Box sx={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#spark-${gid})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}

/** Radial percentage gauge (0–100). Colour shifts by severity when `invert`. */
export function RadialGauge({
  value,
  label,
  color = colors.primary[500],
  size = 120,
}: {
  value: number;
  label: string;
  color?: string;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const rows = [{ name: label, value: clamped, fill: color }];
  return (
    <Box sx={{ position: "relative", width: size, height: size, mx: "auto" }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={rows} startAngle={90} endAngle={-270}>
          <RadialBar background={{ fill: GRID }} dataKey="value" cornerRadius={99} />
        </RadialBarChart>
      </ResponsiveContainer>
      <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: "1.15rem", lineHeight: 1, color }}>
            {clamped.toFixed(1)}%
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
            {label}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

/** Horizontal bars for ranked lists (top clients / debtors). */
export function TopBars({
  rows,
  color = colors.primary[500],
  format = formatNumber,
}: {
  rows: Array<{ name: string; value: number }>;
  color?: string;
  format?: (v: number) => string;
}) {
  if (!rows || rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
        Aucune donnée.
      </Typography>
    );
  }
  const height = Math.max(120, rows.length * 38);
  return (
    <Box sx={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fontSize: 12, fill: colors.neutral[600] }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip format={format} />} cursor={{ fill: colors.neutral[100] }} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={16} animationDuration={600}>
            {rows.map((_, i) => (
              <Cell key={i} fill={color} fillOpacity={1 - i * 0.14} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
