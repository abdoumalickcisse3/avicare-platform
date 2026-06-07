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
import type { WeighingSample } from "@/types";

const CHICK_WEIGHT_G = 40;

interface GrowthChartProps {
  weighings: WeighingSample[];
  targetWeightG: number | null;
  targetAgeDays: number | null;
}

/** Linear target weight at a given age, from a day-old chick to the batch target. */
function targetAt(age: number, targetWeightG: number, targetAgeDays: number): number {
  if (age >= targetAgeDays) return targetWeightG;
  return Math.round(
    CHICK_WEIGHT_G + ((targetWeightG - CHICK_WEIGHT_G) * age) / targetAgeDays,
  );
}

export function GrowthChart({ weighings, targetWeightG, targetAgeDays }: GrowthChartProps) {
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
  const ages = new Set<number>([0, ...realByAge.keys()]);
  if (targetWeightG && targetAgeDays) ages.add(targetAgeDays);

  const data = [...ages]
    .sort((a, b) => a - b)
    .map((age) => ({
      age,
      real: realByAge.get(age) ?? null,
      target:
        targetWeightG && targetAgeDays
          ? targetAt(age, targetWeightG, targetAgeDays)
          : null,
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
        <Line
          type="monotone"
          dataKey="target"
          name="Cible"
          stroke={colors.neutral[400]}
          strokeDasharray="5 5"
          dot={false}
          connectNulls
        />
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
