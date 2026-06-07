import { Box, Typography } from "@mui/material";
import { colors } from "@/theme/tokens";

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  /** Override the value color (e.g. error for mortality). */
  valueColor?: string;
  /** Optional small caption under the value. */
  hint?: string;
}

/**
 * A compact KPI tile: uppercase label + a monospaced, tabular value (JetBrains
 * Mono via the theme `--font-mono`) so figures align. Used in batch cards and
 * the detail overview.
 */
export function StatTile({ label, value, unit, valueColor, hint }: StatTileProps) {
  return (
    <Box
      sx={{
        bgcolor: colors.neutral[50],
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: 2,
        px: 1.5,
        py: 1.25,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: "block",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontSize: "0.65rem",
          color: colors.neutral[500],
          fontWeight: 600,
        }}
      >
        {label}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mt: 0.25 }}>
        <Typography
          component="span"
          sx={{
            fontFamily: "var(--font-mono)",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
            fontSize: "1.15rem",
            color: valueColor ?? colors.neutral[800],
            lineHeight: 1.1,
          }}
        >
          {value}
        </Typography>
        {unit && (
          <Typography
            component="span"
            variant="caption"
            sx={{ color: colors.neutral[500] }}
          >
            {unit}
          </Typography>
        )}
      </Box>
      {hint && (
        <Typography variant="caption" sx={{ color: colors.neutral[500] }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}
