"use client";

import {
  Bar,
  BarChart,
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

/** Daily mortality bars over the last entries. */
export function MortalityChart({ records }: { records: PoultryDailyRecord[] }) {
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
    .slice(-14)
    .map((r) => ({ date: format(new Date(r.recordDate), "dd/MM"), mortality: r.mortalityCount }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral[200]} vertical={false} />
        <XAxis dataKey="date" stroke={colors.neutral[400]} fontSize={11} />
        <YAxis stroke={colors.neutral[400]} fontSize={11} allowDecimals={false} />
        <Tooltip formatter={(v) => [`${v}`, "Mortalité"]} />
        <Bar dataKey="mortality" fill={colors.error.main} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
