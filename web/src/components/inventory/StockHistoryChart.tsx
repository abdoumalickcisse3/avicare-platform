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
import type { StockMovement } from "@/types";

/** Stock level (quantityAfter) over time, from the movement journal. */
export function StockHistoryChart({ movements }: { movements: StockMovement[] }) {
  if (movements.length === 0) {
    return (
      <Box sx={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Aucun mouvement enregistré.
        </Typography>
      </Box>
    );
  }

  const data = [...movements]
    .sort((a, b) => a.movementDate.localeCompare(b.movementDate))
    .map((m) => ({
      date: format(new Date(m.movementDate), "dd/MM"),
      stock: Math.round(m.quantityAfter * 100) / 100,
    }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
        <defs>
          <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.primary[500]} stopOpacity={0.3} />
            <stop offset="95%" stopColor={colors.primary[500]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral[200]} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: colors.neutral[500] }} />
        <YAxis tick={{ fontSize: 12, fill: colors.neutral[500] }} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="stock"
          stroke={colors.primary[500]}
          strokeWidth={2}
          fill="url(#stockGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
