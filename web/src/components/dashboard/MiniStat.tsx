"use client";

import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { colors } from "@/theme/tokens";

/**
 * Compact secondary statistic — a small bordered tile with a coloured accent
 * dot, a label and a value. Used inside the detail panels to pack many numbers
 * densely without the weight of a full card.
 */
export function MiniStat({
  label,
  value,
  tint = colors.primary[500],
  alert = false,
}: {
  label: string;
  value: string;
  tint?: string;
  alert?: boolean;
}) {
  const accent = alert ? colors.warning.main : tint;
  return (
    <Box
      sx={{
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: 2,
        px: 1.25,
        py: 1,
        bgcolor: alert ? alpha(colors.warning.main, 0.06) : "background.paper",
        minWidth: 0,
      }}
    >
      <Stack label={label} accent={accent} />
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: "0.98rem",
          mt: 0.35,
          color: alert ? colors.warning.dark : "text.primary",
          fontVariantNumeric: "tabular-nums",
        }}
        noWrap
      >
        {value}
      </Typography>
    </Box>
  );
}

function Stack({ label, accent }: { label: string; accent: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
      <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: accent, flexShrink: 0 }} />
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }} noWrap>
        {label}
      </Typography>
    </Box>
  );
}
