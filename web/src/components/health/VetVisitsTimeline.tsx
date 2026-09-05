"use client";

import { useMemo, useState } from "react";
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
import { CalendarClock, Plus, Stethoscope, Trash2 } from "lucide-react";
import {
  useDeleteVetVisitMutation,
  useGetVetVisitsQuery,
  useGetVeterinariansQuery,
} from "@/store/api/healthApi";
import { useFarmPermissions } from "@/hooks/useFarmPermissions";
import { canManageCatalog, useFarmRole } from "@/hooks/useFarmRole";
import { useToast } from "@/components/feedback/ToastProvider";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { apiErrorMessage } from "@/lib/apiError";
import { isFeatureForbidden } from "@/lib/poultry";
import { formatCurrency, formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import { VetVisitDialog } from "./VetVisitDialog";
import type { VetVisit } from "@/types";

export function VetVisitsTimeline({
  farmId,
  unitId,
  unitName,
}: {
  farmId: number;
  unitId: number;
  unitName: string;
}) {
  const { data: visits, isLoading, error } = useGetVetVisitsQuery({ farmId, unitId });
  const { data: vets = [] } = useGetVeterinariansQuery({ farmId });
  const [open, setOpen] = useState(false);
  const [toRemove, setToRemove] = useState<VetVisit | null>(null);

  // The backend gates the delete on OWNER/MANAGER, not on `health:write`: a member who may record
  // a visit is not necessarily allowed to cancel the expense it booked. Mirror both here so the
  // button is absent rather than answering 403.
  const { can } = useFarmPermissions(farmId);
  const role = useFarmRole(farmId);
  const canDelete = can("health:write") && canManageCatalog(role);

  const [deleteVisit, { isLoading: deleting }] = useDeleteVetVisitMutation();
  const { showToast } = useToast();

  const confirmRemove = async () => {
    if (!toRemove) return;
    try {
      await deleteVisit({ farmId, id: toRemove.id, unitId }).unwrap();
      setToRemove(null);
      showToast("Visite supprimée.", "success");
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  const vetName = useMemo(() => {
    const map = new Map(vets.map((v) => [v.id, v.fullName]));
    return (id: number | null) => (id != null ? map.get(id) ?? "Vétérinaire" : "Visite anonyme");
  }, [vets]);

  return (
    <Card sx={{ p: 2.5 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Stethoscope size={18} color={colors.vet.main} />
          <Typography sx={{ fontWeight: 700 }}>Visites vétérinaires</Typography>
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
      ) : !visits?.length ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>
          Aucune visite enregistrée.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {visits.map((v) => (
            <Box
              key={v.id}
              sx={{
                display: "flex",
                gap: 1.5,
                p: 1.5,
                border: `1px solid ${colors.neutral[200]}`,
                borderRadius: 2,
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: colors.vet.light,
                  color: colors.vet.dark,
                }}
              >
                <Stethoscope size={16} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                  <Typography sx={{ fontWeight: 600 }}>{vetName(v.veterinarianId)}</Typography>
                  {v.followUpNeeded && v.followUpDate && (
                    <Chip
                      size="small"
                      icon={<CalendarClock size={12} />}
                      label={`Suivi ${formatDate(v.followUpDate)}`}
                      sx={{ bgcolor: colors.vet.light, color: colors.vet.dark, fontWeight: 600 }}
                    />
                  )}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {v.reason}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(v.visitDate)}
                  {v.costXof != null ? ` · ${v.costXof.toLocaleString("fr-FR")} XOF` : ""}
                </Typography>
              </Box>
              {canDelete && (
                <IconButton
                  size="small"
                  aria-label={`Supprimer la visite du ${formatDate(v.visitDate)}`}
                  onClick={() => setToRemove(v)}
                  sx={{ alignSelf: "flex-start", color: colors.neutral[500] }}
                >
                  <Trash2 size={16} />
                </IconButton>
              )}
            </Box>
          ))}
        </Stack>
      )}

      <VetVisitDialog
        open={open}
        onClose={() => setOpen(false)}
        farmId={farmId}
        unitId={unitId}
        unitName={unitName}
      />

      <ConfirmDialog
        open={Boolean(toRemove)}
        title="Supprimer cette visite ?"
        message={
          toRemove?.costXof
            ? `La dépense de ${formatCurrency(toRemove.costXof)} enregistrée pour cette visite sera annulée dans votre comptabilité.`
            : "La visite disparaîtra de l'historique du lot."
        }
        confirmLabel="Supprimer"
        danger
        loading={deleting}
        onConfirm={confirmRemove}
        onClose={() => setToRemove(null)}
      />
    </Card>
  );
}
