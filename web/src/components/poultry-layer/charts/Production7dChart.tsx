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
import type { DailyProduction } from "@/types";

/** Eggs collected per day over the last closed days (good vs broken stacked). */
export function Production7dChart({
  productions,
}: {
  productions: DailyProduction[];
}) {
  if (productions.length === 0) {
    return (
      <Box sx={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Aucune journée clôturée à afficher.
        </Typography>
      </Box>
    );
  }

  const data = [...productions]
    .sort((a, b) => a.productionDate.localeCompare(b.productionDate))
    .slice(-7)
    .map((p) => ({
      date: format(new Date(p.productionDate), "dd/MM"),
      collectes: p.totalEggsCollected,
      casses: p.totalBrokenEggs,
    }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral[200]} vertical={false} />
        <XAxis dataKey="date" stroke={colors.neutral[400]} fontSize={11} />
        <YAxis stroke={colors.neutral[400]} fontSize={11} allowDecimals={false} />
        <Tooltip
          formatter={(v, name) => [`${v}`, name === "casses" ? "Cassés" : "Collectés"]}
        />
        <Bar dataKey="collectes" stackId="eggs" fill={colors.primary[500]} radius={[0, 0, 0, 0]} />
        <Bar dataKey="casses" stackId="eggs" fill={colors.error.main} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
