"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Box, Typography } from "@mui/material";
import { format } from "date-fns";
import { colors } from "@/theme/tokens";
import { TARGET_LAYING_RATE_PCT } from "@/lib/layer";
import type { DailyProduction } from "@/types";

/** Real laying rate (%) per closed day vs the peak target reference line. */
export function LayingRateCurve({
  productions,
}: {
  productions: DailyProduction[];
}) {
  const withRate = productions.filter((p) => p.layingRatePct != null);

  if (withRate.length === 0) {
    return (
      <Box sx={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Clôturez une journée pour afficher le taux de ponte.
        </Typography>
      </Box>
    );
  }

  const data = [...withRate]
    .sort((a, b) => a.productionDate.localeCompare(b.productionDate))
    .map((p) => ({
      date: format(new Date(p.productionDate), "dd/MM"),
      reel: Number(p.layingRatePct),
    }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral[200]} />
        <XAxis dataKey="date" stroke={colors.neutral[400]} fontSize={12} />
        <YAxis
          stroke={colors.neutral[400]}
          fontSize={12}
          width={40}
          unit="%"
          domain={[0, 100]}
        />
        <Tooltip formatter={(v) => [`${v} %`, "Taux de ponte"]} />
        <ReferenceLine
          y={TARGET_LAYING_RATE_PCT}
          stroke={colors.accent[400]}
          strokeDasharray="5 5"
          label={{
            value: "Cible",
            position: "right",
            fill: colors.accent[500],
            fontSize: 11,
          }}
        />
        <Line
          type="monotone"
          dataKey="reel"
          name="Réel"
          stroke={colors.primary[500]}
          strokeWidth={2.5}
          dot={{ r: 3 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
