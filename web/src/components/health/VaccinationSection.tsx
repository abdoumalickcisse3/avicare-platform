"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { CalendarRange, Plus, Syringe, X } from "lucide-react";
import {
  useAssignProgramMutation,
  useGetProgramAssignmentQuery,
  useGetProgramsQuery,
  useGetScheduleQuery,
  useRemoveProgramMutation,
} from "@/store/api/healthApi";
import { useGetBreedsQuery } from "@/store/api/breedsApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { colors } from "@/theme/tokens";
import { VaccinationCalendar } from "./VaccinationCalendar";
import { VaccinationDialog, type VaccinationPrefill } from "./VaccinationDialog";

export function VaccinationSection({
  farmId,
  unitId,
  unitName,
  breedId,
  startDate,
  currentAgeDays,
  currentCount,
  currentUserId,
}: {
  farmId: number;
  unitId: number;
  unitName: string;
  breedId: number | null;
  startDate: string;
  currentAgeDays: number;
  currentCount: number;
  currentUserId?: number;
}) {
  const { showToast } = useToast();
  const { data: assignment, isLoading: assignmentLoading } = useGetProgramAssignmentQuery({
    farmId,
    unitId,
  });
  const { data: schedule = [], isLoading: scheduleLoading } = useGetScheduleQuery(
    { farmId, unitId },
    { skip: !assignment },
  );
  const { data: programs = [] } = useGetProgramsQuery({ farmId });
  const { data: breeds = [] } = useGetBreedsQuery();
  const [assignProgram, { isLoading: assigning }] = useAssignProgramMutation();
  const [removeProgram] = useRemoveProgramMutation();

  const [selectedProgram, setSelectedProgram] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefill, setPrefill] = useState<VaccinationPrefill | undefined>();

  // Programs matching the lot's breed (by code), falling back to all programs.
  const breedCode = useMemo(
    () => breeds.find((b) => b.id === breedId)?.code,
    [breeds, breedId],
  );
  const suggested = useMemo(() => {
    if (!breedCode) return programs;
    const matched = programs.filter((p) => p.breedKeys.includes(breedCode));
    return matched.length ? matched : programs;
  }, [programs, breedCode]);

  const onAssign = async () => {
    if (!selectedProgram) return;
    try {
      await assignProgram({ farmId, unitId, programKey: selectedProgram }).unwrap();
      showToast("Programme vaccinal assigné.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const onRemove = async () => {
    try {
      await removeProgram({ farmId, unitId }).unwrap();
      showToast("Programme retiré.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const openManual = () => {
    setPrefill(undefined);
    setDialogOpen(true);
  };
  const openFromEntry = (entry: { vaccineKey: string; route?: string; dueDate?: string }) => {
    setPrefill({ vaccineKey: entry.vaccineKey, route: entry.route, administeredDate: undefined });
    setDialogOpen(true);
  };

  const programLabel = useMemo(
    () => programs.find((p) => p.key === assignment?.programKey)?.label,
    [programs, assignment],
  );

  return (
    <Card sx={{ p: 2.5 }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <CalendarRange size={18} color={colors.primary[600]} />
          <Typography sx={{ fontWeight: 700 }}>Calendrier de vaccination</Typography>
          {programLabel && (
            <Chip
              size="small"
              label={programLabel}
              onDelete={onRemove}
              deleteIcon={<X size={14} />}
              sx={{ bgcolor: colors.primary[50], color: colors.primary[700], fontWeight: 600 }}
            />
          )}
        </Stack>
        {assignment && (
          <Button
            size="small"
            variant="contained"
            color="secondary"
            startIcon={<Syringe size={16} />}
            onClick={openManual}
          >
            Saisir une vaccination
          </Button>
        )}
      </Stack>

      {assignmentLoading ? (
        <Skeleton variant="rounded" height={168} />
      ) : !assignment ? (
        <Box
          sx={{
            p: 3,
            textAlign: "center",
            border: `1px dashed ${colors.neutral[300]}`,
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Aucun programme vaccinal assigné à ce lot.
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ justifyContent: "center", alignItems: "center" }}
          >
            <TextField
              select
              size="small"
              label="Programme"
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              sx={{ minWidth: 240 }}
            >
              {suggested.map((p) => (
                <MenuItem key={p.key} value={p.key}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<Plus size={16} />}
              disabled={!selectedProgram || assigning}
              onClick={onAssign}
            >
              Assigner
            </Button>
          </Stack>
          <Button
            size="small"
            sx={{ mt: 1.5 }}
            startIcon={<Syringe size={16} />}
            onClick={openManual}
          >
            Saisir une vaccination ponctuelle
          </Button>
        </Box>
      ) : scheduleLoading ? (
        <Skeleton variant="rounded" height={168} />
      ) : schedule.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Le programme ne contient aucune dose programmée.
        </Typography>
      ) : (
        <VaccinationCalendar
          schedule={schedule}
          startDate={startDate}
          currentAgeDays={currentAgeDays}
          onSelectEntry={(e) => openFromEntry(e)}
        />
      )}

      <VaccinationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        farmId={farmId}
        unitId={unitId}
        unitName={unitName}
        currentCount={currentCount}
        currentUserId={currentUserId}
        prefill={prefill}
      />
    </Card>
  );
}
