"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Box, Typography } from "@mui/material";
import { format } from "date-fns";
import { colors } from "@/theme/tokens";
import type { PoultryDailyRecord } from "@/types";

/** Cumulative feed (kg) over time. */
export function FeedConsumptionChart({ records }: { records: PoultryDailyRecord[] }) {
  if (records.length === 0) {
    return (
      <Box sx={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Aucune saisie quotidienne.
        </Typography>
      </Box>
    );
  }

  const data = [...records]
    .sort((a, b) => a.recordDate.localeCompare(b.recordDate))
    .reduce<{ date: string; cumulative: number }[]>((acc, r) => {
      const running = (acc[acc.length - 1]?.cumulative ?? 0) + (Number(r.feedKg) || 0);
      acc.push({ date: format(new Date(r.recordDate), "dd/MM"), cumulative: Math.round(running) });
      return acc;
    }, []);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
        <defs>
          <linearGradient id="feedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.primary[500]} stopOpacity={0.35} />
            <stop offset="100%" stopColor={colors.primary[500]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral[200]} vertical={false} />
        <XAxis dataKey="date" stroke={colors.neutral[400]} fontSize={11} />
        <YAxis stroke={colors.neutral[400]} fontSize={11} width={48} unit="kg" />
        <Tooltip formatter={(v) => [`${v} kg`, "Cumulé"]} />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke={colors.primary[500]}
          strokeWidth={2}
          fill="url(#feedGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
