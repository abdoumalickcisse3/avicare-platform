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
import { Eye, Plus, Trash2 } from "lucide-react";
import {
  useDeleteObservationMutation,
  useGetObservationsQuery,
} from "@/store/api/healthApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { isFeatureForbidden } from "@/lib/poultry";
import { formatDate } from "@/lib/format";
import { severityChip, humanizeKey } from "@/lib/health";
import { colors } from "@/theme/tokens";
import { ObservationDialog } from "./ObservationDialog";

export function ObservationsList({
  farmId,
  unitId,
  unitName,
  currentUserId,
}: {
  farmId: number;
  unitId: number;
  unitName: string;
  currentUserId?: number;
}) {
  const { showToast } = useToast();
  const { data: observations, isLoading, error } = useGetObservationsQuery({ farmId, unitId });
  const [deleteObservation] = useDeleteObservationMutation();
  const [open, setOpen] = useState(false);

  const onDelete = async (id: number) => {
    try {
      await deleteObservation({ farmId, id, unitId }).unwrap();
      showToast("Observation supprimée.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Card sx={{ p: 2.5 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Eye size={18} color={colors.primary[600]} />
          <Typography sx={{ fontWeight: 700 }}>Observations</Typography>
        </Stack>
        <Button size="small" startIcon={<Plus size={16} />} onClick={() => setOpen(true)}>
          Ajouter
        </Button>
      </Stack>

      {isLoading ? (
        <Stack spacing={1}>
          <Skeleton variant="rounded" height={56} />
          <Skeleton variant="rounded" height={56} />
        </Stack>
      ) : error && !isFeatureForbidden(error) ? (
        <Typography variant="body2" color="error">
          {apiErrorMessage(error)}
        </Typography>
      ) : !observations?.length ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>
          Aucune observation enregistrée.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {observations.map((o) => {
            const chip = severityChip(o.severity);
            return (
              <Box
                key={o.id}
                sx={{
                  display: "flex",
                  gap: 1.5,
                  alignItems: "flex-start",
                  p: 1.5,
                  border: `1px solid ${colors.neutral[200]}`,
                  borderRadius: 2,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                    <Typography sx={{ fontWeight: 600 }}>{o.title}</Typography>
                    <Chip
                      size="small"
                      label={chip.label}
                      sx={{ bgcolor: chip.bg, color: chip.fg, fontWeight: 600 }}
                    />
                  </Stack>
                  {o.description && (
                    <Typography variant="body2" color="text.secondary">
                      {o.description}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(o.observationDate)}
                    {o.suspectedDisease ? ` · ${humanizeKey(o.suspectedDisease)}` : ""}
                  </Typography>
                </Box>
                <IconButton size="small" aria-label="Supprimer" onClick={() => onDelete(o.id)}>
                  <Trash2 size={16} />
                </IconButton>
              </Box>
            );
          })}
        </Stack>
      )}

      <ObservationDialog
        open={open}
        onClose={() => setOpen(false)}
        farmId={farmId}
        unitId={unitId}
        unitName={unitName}
        currentUserId={currentUserId}
      />
    </Card>
  );
}
