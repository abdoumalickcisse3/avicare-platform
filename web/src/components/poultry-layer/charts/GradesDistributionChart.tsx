"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Box, Stack, Typography } from "@mui/material";
import { colors } from "@/theme/tokens";
import { sortGradeKeys } from "@/lib/layer";

/** Palette for grade slices, drawn from the design tokens (never hardcoded hex). */
const SLICE_COLORS = [
  colors.primary[500],
  colors.accent[400],
  colors.info.main,
  colors.success.main,
  colors.primary[300],
  colors.accent[600],
];

/** Donut of the egg-grade distribution for a closed day (or aggregate). */
export function GradesDistributionChart({
  gradesCount,
}: {
  gradesCount: Record<string, number>;
}) {
  const keys = sortGradeKeys(Object.keys(gradesCount)).filter(
    (k) => (gradesCount[k] ?? 0) > 0,
  );
  const data = keys.map((k) => ({ name: k, value: gradesCount[k] }));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <Box sx={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Aucune répartition par calibre.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 2 }}>
      <Box sx={{ width: 160, height: 200, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={2}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v, name) => [`${v} œufs`, `Calibre ${name}`]} />
          </PieChart>
        </ResponsiveContainer>
      </Box>
      <Stack spacing={0.75} sx={{ flex: 1 }}>
        {data.map((d, i) => (
          <Stack key={d.name} direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: 0.5,
                bgcolor: SLICE_COLORS[i % SLICE_COLORS.length],
              }}
            />
            <Typography variant="body2" sx={{ flex: 1 }}>
              Calibre {d.name}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
            >
              {Math.round((d.value / total) * 100)}%
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
