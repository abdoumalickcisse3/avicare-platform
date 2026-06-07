import { Chip } from "@mui/material";
import { colors } from "@/theme/tokens";
import type { BatchStatus } from "@/types";

const META: Record<BatchStatus, { label: string; bg: string; fg: string }> = {
  ACTIVE: { label: "Actif", bg: colors.success.light, fg: colors.success.dark },
  CLOSED: { label: "Clôturé", bg: colors.neutral[200], fg: colors.neutral[700] },
  PLANNED: { label: "Planifié", bg: colors.accent[50], fg: colors.accent[700] },
  CANCELLED: { label: "Annulé", bg: colors.error.light, fg: colors.error.dark },
};

export function BatchStatusChip({ status }: { status: BatchStatus }) {
  const m = META[status];
  return (
    <Chip
      label={m.label}
      size="small"
      sx={{ bgcolor: m.bg, color: m.fg, fontWeight: 600, fontSize: "0.7rem" }}
    />
  );
}
