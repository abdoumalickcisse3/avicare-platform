"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Eye, X } from "lucide-react";
import { useRecordObservationMutation } from "@/store/api/healthApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { severityChip } from "@/lib/health";
import { colors } from "@/theme/tokens";
import { SectionLabel, today } from "./HealthDialogParts";
import type { ObservationSeverity } from "@/types";

const SEVERITIES: ObservationSeverity[] = ["NORMAL", "WARNING", "CRITICAL"];

/** Common suspected diseases to speed up field entry (autocomplete free-text). */
const COMMON_DISEASES = [
  "Newcastle",
  "Gumboro",
  "Bronchite infectieuse",
  "Coccidiose",
  "Choléra aviaire",
  "Variole aviaire",
  "Salmonellose",
  "Colibacillose",
];

const schema = z.object({
  observationDate: z.string().min(1, "Date requise"),
  severity: z.enum(["NORMAL", "WARNING", "CRITICAL"]),
  title: z.string().min(1, "Titre requis").max(200),
  description: z.string().optional().or(z.literal("")),
  suspectedDisease: z.string().max(100).optional().or(z.literal("")),
});

type ObservationForm = z.infer<typeof schema>;

export function ObservationDialog({
  open,
  onClose,
  farmId,
  unitId,
  unitName,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  unitId: number;
  unitName: string;
  currentUserId?: number;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { showToast } = useToast();
  const [recordObservation, { isLoading }] = useRecordObservationMutation();

  const defaults = useMemo<ObservationForm>(
    () => ({
      observationDate: today(),
      severity: "NORMAL",
      title: "",
      description: "",
      suspectedDisease: "",
    }),
    [],
  );

  const { control, handleSubmit, reset } = useForm<ObservationForm>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
  }, [open, reset, defaults]);

  const onSubmit = async (values: ObservationForm) => {
    try {
      await recordObservation({
        farmId,
        body: {
          unitId,
          observationDate: values.observationDate,
          severity: values.severity,
          title: values.title,
          description: values.description || undefined,
          suspectedDisease: values.suspectedDisease || undefined,
          observedByUserId: currentUserId,
        },
      }).unwrap();
      showToast("Observation enregistrée.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle component="div" sx={{ pr: 6 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Nouvelle observation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {unitName}
          </Typography>
          <IconButton
            onClick={onClose}
            aria-label="Fermer"
            sx={{ position: "absolute", top: 12, right: 12 }}
          >
            <X size={20} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <SectionLabel color={colors.primary[500]}>Gravité</SectionLabel>
            <Controller
              name="severity"
              control={control}
              render={({ field }) => (
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  value={field.value}
                  onChange={(_, v) => v && field.onChange(v)}
                >
                  {SEVERITIES.map((s) => {
                    const chip = severityChip(s);
                    const active = field.value === s;
                    return (
                      <ToggleButton
                        key={s}
                        value={s}
                        sx={{
                          fontWeight: 600,
                          color: chip.fg,
                          "&.Mui-selected": { bgcolor: chip.bg, color: chip.fg },
                          "&.Mui-selected:hover": { bgcolor: chip.bg },
                          ...(active ? { borderColor: chip.fg } : {}),
                        }}
                      >
                        {chip.label}
                      </ToggleButton>
                    );
                  })}
                </ToggleButtonGroup>
              )}
            />

            <SectionLabel color={colors.primary[500]}>Détails</SectionLabel>
            <Controller
              name="observationDate"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Date de l'observation"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today() } }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="title"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Titre"
                  placeholder="ex. Mortalité aiguë, comportement anormal…"
                  fullWidth
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="suspectedDisease"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  options={COMMON_DISEASES}
                  value={field.value || ""}
                  onInputChange={(_, v) => field.onChange(v)}
                  renderInput={(params) => (
                    <TextField {...params} label="Maladie suspectée (optionnel)" />
                  )}
                />
              )}
            />
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Description"
                  placeholder="Symptômes, circonstances, effectif concerné…"
                  fullWidth
                  multiline
                  minRows={3}
                />
              )}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, position: "sticky", bottom: 0, bgcolor: "background.paper" }}>
          <Button onClick={onClose} color="inherit">
            Annuler
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="secondary"
            disabled={isLoading}
            startIcon={<Eye size={18} />}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
