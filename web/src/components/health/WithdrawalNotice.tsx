"use client";

import { Box, Chip, Stack, Typography } from "@mui/material";
import { AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";

/**
 * Orange informational box for treatment withdrawal periods. Strictly a WARNING
 * — never a hard block (decision locked: withdrawal is exposed, sales are never
 * prevented). Shows the min meat/egg sale dates after the withdrawal delay.
 */
export function WithdrawalNotice({
  withdrawalDaysMeat,
  withdrawalDaysEggs,
  withdrawalEndDateMeat,
  withdrawalEndDateEggs,
  compact = false,
}: {
  withdrawalDaysMeat: number | null;
  withdrawalDaysEggs: number | null;
  withdrawalEndDateMeat: string | null;
  withdrawalEndDateEggs: string | null;
  compact?: boolean;
}) {
  const hasAny =
    withdrawalDaysMeat != null ||
    withdrawalDaysEggs != null ||
    withdrawalEndDateMeat != null ||
    withdrawalEndDateEggs != null;

  return (
    <Box
      sx={{
        border: `1px solid ${colors.warning.main}`,
        bgcolor: colors.warning.light,
        borderRadius: 2,
        p: compact ? 1.5 : 2,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.75 }}>
        <Box sx={{ color: colors.warning.dark, display: "flex" }}>
          <AlertTriangle size={compact ? 16 : 18} />
        </Box>
        <Typography sx={{ fontWeight: 700, color: colors.warning.dark }}>
          Alerte sanitaire — délai d&apos;attente
        </Typography>
      </Stack>

      {!hasAny ? (
        <Typography variant="body2" sx={{ color: colors.warning.dark }}>
          Aucun délai d&apos;attente officiel renseigné pour ce traitement.
        </Typography>
      ) : (
        <Stack spacing={0.75}>
          <SaleRow
            label="Viande"
            days={withdrawalDaysMeat}
            endDate={withdrawalEndDateMeat}
          />
          <SaleRow
            label="Œufs"
            days={withdrawalDaysEggs}
            endDate={withdrawalEndDateEggs}
          />
          <Typography variant="caption" sx={{ color: colors.warning.dark, fontStyle: "italic" }}>
            Aucune vente recommandée avant cette date.
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

function SaleRow({
  label,
  days,
  endDate,
}: {
  label: string;
  days: number | null;
  endDate: string | null;
}) {
  if (days == null && endDate == null) return null;
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
    >
      <Typography variant="body2" sx={{ color: colors.warning.dark }}>
        {label}
        {days != null ? ` · ${days} j après fin de traitement` : ""}
      </Typography>
      {endDate && (
        <Chip
          size="small"
          label={`Vente dès le ${formatDate(endDate)}`}
          sx={{
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            bgcolor: colors.accent[100],
            color: colors.accent[800],
          }}
        />
      )}
    </Stack>
  );
}
