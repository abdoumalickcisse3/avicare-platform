"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Box, Typography } from "@mui/material";
import { format, parseISO } from "date-fns";
import { reconstructFlockCurve } from "@/lib/flock";
import { colors } from "@/theme/tokens";
import type { LifecycleEvent } from "@/types";

export function FlockCountCurve({ events }: { events: LifecycleEvent[] }) {
  const data = reconstructFlockCurve(events).map((p) => ({
    date: p.date,
    label: format(parseISO(p.date), "dd/MM"),
    count: p.count,
  }));

  if (data.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Aucun événement pour tracer l&apos;effectif.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral[100]} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: colors.neutral[500] }} />
          <YAxis
            tick={{ fontSize: 12, fill: colors.neutral[500] }}
            allowDecimals={false}
            width={48}
          />
          <Tooltip
            formatter={(v) => [v, "Effectif"]}
            labelFormatter={(l) => `Le ${l}`}
          />
          <Line
            type="stepAfter"
            dataKey="count"
            stroke={colors.info.main}
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
