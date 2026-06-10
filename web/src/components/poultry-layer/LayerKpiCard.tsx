"use client";

import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { colors } from "@/theme/tokens";

const monoSx = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
} as const;

/** A KPI card with a tinted icon — same look as the broiler overview tiles. */
export function LayerKpiCard({
  label,
  value,
  unit,
  hint,
  icon,
  tint,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: string;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mt: 0.5 }}>
              <Typography sx={{ ...monoSx, fontSize: "1.5rem", color: colors.neutral[800] }}>
                {value}
              </Typography>
              {unit && (
                <Typography variant="caption" color="text.secondary">
                  {unit}
                </Typography>
              )}
            </Box>
            {hint && (
              <Typography variant="caption" color="text.secondary">
                {hint}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: `${tint}1A`,
              color: tint,
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
