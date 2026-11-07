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
import { colors } from "@/theme/tokens";
import type { ExpectedWeightPoint, WeighingSample } from "@/types";

interface GrowthChartProps {
  weighings: WeighingSample[];
  /**
   * Server-computed growth reference ({@code PoultryBatchResponse.expectedCurve}) — never
   * computed client-side. An empty array means the breed's profile has no validated reference
   * (rustic/local breeds) or the batch has no target: draw no reference line at all rather than
   * guess one, exactly as the server chose to send nothing.
   */
  expectedCurve: ExpectedWeightPoint[];
}

export function GrowthChart({ weighings, expectedCurve }: GrowthChartProps) {
  if (weighings.length === 0) {
    return (
      <Box sx={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Ajoutez une pesée pour afficher la courbe de croissance.
        </Typography>
      </Box>
    );
  }

  const realByAge = new Map(weighings.map((w) => [w.ageDays, Math.round(w.avgWeightG)]));
  const targetByAge = new Map(expectedCurve.map((p) => [p.ageDays, p.weightG]));
  const ages = new Set<number>([0, ...realByAge.keys(), ...targetByAge.keys()]);
  const hasReference = expectedCurve.length > 0;

  const data = [...ages]
    .sort((a, b) => a - b)
    .map((age) => ({
      age,
      real: realByAge.get(age) ?? null,
      target: targetByAge.get(age) ?? null,
    }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.neutral[200]} />
        <XAxis
          dataKey="age"
          tickFormatter={(v) => `J${v}`}
          stroke={colors.neutral[400]}
          fontSize={12}
        />
        <YAxis stroke={colors.neutral[400]} fontSize={12} width={48} unit="g" />
        <Tooltip
          formatter={(v) => [`${v} g`, ""]}
          labelFormatter={(l) => `Jour ${l}`}
        />
        {hasReference && (
          <Line
            type="monotone"
            dataKey="target"
            name="Cible"
            stroke={colors.neutral[400]}
            strokeDasharray="5 5"
            dot={false}
            connectNulls
          />
        )}
        <Line
          type="monotone"
          dataKey="real"
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
