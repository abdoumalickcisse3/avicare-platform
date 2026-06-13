"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { CalendarClock, Plus, Stethoscope } from "lucide-react";
import {
  useGetVetVisitsQuery,
  useGetVeterinariansQuery,
} from "@/store/api/healthApi";
import { apiErrorMessage } from "@/lib/apiError";
import { isFeatureForbidden } from "@/lib/poultry";
import { formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import { VetVisitDialog } from "./VetVisitDialog";

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
    </Card>
  );
}
