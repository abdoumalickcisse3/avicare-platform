"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { Pill, Plus, Trash2 } from "lucide-react";
import {
  useDeleteTreatmentMutation,
  useGetTreatmentsQuery,
} from "@/store/api/healthApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { isFeatureForbidden } from "@/lib/poultry";
import { formatDate } from "@/lib/format";
import { daysBetween, humanizeKey, isoToday } from "@/lib/health";
import { colors } from "@/theme/tokens";
import { TreatmentDialog } from "./TreatmentDialog";
import { WithdrawalNotice } from "./WithdrawalNotice";
import type { ExecutedTreatment } from "@/types";

/** Days remaining until the latest withdrawal end date; null if none/passed. */
function withdrawalDaysRemaining(t: ExecutedTreatment): number | null {
  const dates = [t.withdrawalEndDateMeat, t.withdrawalEndDateEggs].filter(
    (d): d is string => !!d,
  );
  if (!dates.length) return null;
  const today = isoToday();
  const remaining = dates.map((d) => daysBetween(today, d)).filter((n) => n >= 0);
  return remaining.length ? Math.max(...remaining) : null;
}

export function ActiveTreatmentsList({
  farmId,
  unitId,
  unitName,
  currentCount,
  currentUserId,
}: {
  farmId: number;
  unitId: number;
  unitName: string;
  currentCount: number;
  currentUserId?: number;
}) {
  const { showToast } = useToast();
  const { data: treatments, isLoading, error } = useGetTreatmentsQuery({ farmId, unitId });
  const [deleteTreatment] = useDeleteTreatmentMutation();
  const [open, setOpen] = useState(false);

  const onDelete = async (id: number) => {
    try {
      await deleteTreatment({ farmId, id, unitId }).unwrap();
      showToast("Traitement supprimé.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Card sx={{ p: 2.5 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Pill size={18} color={colors.info.main} />
          <Typography sx={{ fontWeight: 700 }}>Traitements</Typography>
        </Stack>
        <Button size="small" startIcon={<Plus size={16} />} onClick={() => setOpen(true)}>
          Ajouter
        </Button>
      </Stack>

      {isLoading ? (
        <Stack spacing={1}>
          <Skeleton variant="rounded" height={64} />
          <Skeleton variant="rounded" height={64} />
        </Stack>
      ) : error && !isFeatureForbidden(error) ? (
        <Typography variant="body2" color="error">
          {apiErrorMessage(error)}
        </Typography>
      ) : !treatments?.length ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>
          Aucun traitement enregistré.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {treatments.map((t) => {
            const remaining = withdrawalDaysRemaining(t);
            const active = remaining != null && remaining > 0;
            return (
              <Box
                key={t.id}
                sx={{ p: 1.5, border: `1px solid ${colors.neutral[200]}`, borderRadius: 2 }}
              >
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                      <Typography sx={{ fontWeight: 600 }}>{humanizeKey(t.treatmentKey)}</Typography>
                      {active && (
                        <Chip
                          size="small"
                          label={`Délai · ${remaining} j restants`}
                          sx={{
                            bgcolor: colors.warning.light,
                            color: colors.warning.dark,
                            fontWeight: 600,
                            fontFamily: "var(--font-mono)",
                          }}
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(t.startDate)} → {formatDate(t.endDate)} · {t.doseAmount}{" "}
                      {t.doseUnit} · {t.route}
                    </Typography>
                  </Box>
                  <IconButton size="small" aria-label="Supprimer" onClick={() => onDelete(t.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                </Stack>
                {active && (
                  <Box sx={{ mt: 1 }}>
                    <WithdrawalNotice
                      compact
                      withdrawalDaysMeat={t.withdrawalDaysMeat}
                      withdrawalDaysEggs={t.withdrawalDaysEggs}
                      withdrawalEndDateMeat={t.withdrawalEndDateMeat}
                      withdrawalEndDateEggs={t.withdrawalEndDateEggs}
                    />
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      )}

      <TreatmentDialog
        open={open}
        onClose={() => setOpen(false)}
        farmId={farmId}
        unitId={unitId}
        unitName={unitName}
        currentCount={currentCount}
        currentUserId={currentUserId}
      />
    </Card>
  );
}
