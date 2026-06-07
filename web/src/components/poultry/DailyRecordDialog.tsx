"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Skull, X } from "lucide-react";
import { useCreateDailyRecordMutation } from "@/store/api/poultryBatchesApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";

const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  recordDate: z.string().min(1, "Date requise"),
  mortalityCount: z.string().regex(/^\d+$/, "Nombre entier requis"),
  feedKg: z
    .string()
    .regex(/^\d*([.,]\d+)?$/, "Nombre invalide")
    .optional()
    .or(z.literal("")),
  waterL: z
    .string()
    .regex(/^\d*([.,]\d+)?$/, "Nombre invalide")
    .optional()
    .or(z.literal("")),
  observations: z.string().max(1000, "1000 caractères maximum").optional().or(z.literal("")),
});

type RecordForm = z.infer<typeof schema>;

const DEFAULTS: RecordForm = {
  recordDate: today(),
  mortalityCount: "",
  feedKg: "",
  waterL: "",
  observations: "",
};

const numField = (v?: string) => {
  const n = v ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

export function DailyRecordDialog({
  open,
  onClose,
  farmId,
  batchId,
  currentCount,
  existingDates,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  batchId: number;
  currentCount: number;
  existingDates: string[];
}) {
  const { showToast } = useToast();
  const [createRecord, { isLoading }] = useCreateDailyRecordMutation();

  const { control, handleSubmit, reset } = useForm<RecordForm>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (open) reset(DEFAULTS);
  }, [open, reset]);

  const dateSet = useMemo(() => new Set(existingDates), [existingDates]);
  const watchedDate = useWatch({ control, name: "recordDate" });
  const isUpdate = !!watchedDate && dateSet.has(watchedDate);

  const onSubmit = async (values: RecordForm) => {
    try {
      await createRecord({
        farmId,
        batchId,
        body: {
          recordDate: values.recordDate,
          mortalityCount: Number(values.mortalityCount),
          feedKg: numField(values.feedKg),
          waterL: numField(values.waterL),
          observations: values.observations || undefined,
        },
      }).unwrap();
      showToast(
        isUpdate ? "Saisie mise à jour." : "Saisie enregistrée avec succès.",
        "success",
      );
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle component="div" sx={{ pr: 6 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Nouvelle saisie quotidienne
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Effectif actuel :{" "}
            <Box
              component="span"
              sx={{
                fontFamily: "var(--font-mono)",
                fontVariantNumeric: "tabular-nums",
                fontWeight: 700,
              }}
            >
              {formatNumber(currentCount)}
            </Box>{" "}
            sujets
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
            <Controller
              name="recordDate"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Date de la saisie"
                  fullWidth
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { max: today() },
                  }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            {isUpdate && (
              <Alert severity="info" sx={{ py: 0.5 }}>
                Une saisie existe déjà pour cette date — elle sera mise à jour.
              </Alert>
            )}

            <Controller
              name="mortalityCount"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  type="number"
                  label="Mortalité du jour"
                  placeholder="0"
                  fullWidth
                  required
                  autoFocus
                  slotProps={{
                    htmlInput: { inputMode: "numeric", min: 0 },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Skull size={18} color={colors.error.main} />
                        </InputAdornment>
                      ),
                    },
                  }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? "Nombre de sujets morts (déduit de l'effectif)"}
                />
              )}
            />

            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                name="feedKg"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Aliment (kg)"
                    fullWidth
                    slotProps={{ htmlInput: { inputMode: "decimal", min: 0, step: "0.1" } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="waterL"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Eau (L)"
                    fullWidth
                    slotProps={{ htmlInput: { inputMode: "decimal", min: 0, step: "0.1" } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Box>

            <Controller
              name="observations"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Observations"
                  placeholder="Comportement, symptômes, interventions…"
                  fullWidth
                  multiline
                  minRows={2}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} color="inherit">
            Annuler
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isUpdate ? "Mettre à jour" : "Enregistrer"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
