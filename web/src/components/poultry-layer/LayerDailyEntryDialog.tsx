"use client";

import { useEffect, useMemo, useState } from "react";
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
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import { useCreateDailyRecordMutation } from "@/store/api/poultryBatchesApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { useInventoryGating } from "@/hooks/useInventoryGating";
import { FeedSourceSection } from "@/components/inventory/FeedSourceSection";
import { apiErrorMessage } from "@/lib/apiError";
import type { FeedFormulaRef, StockConsumption } from "@/types";

const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  recordDate: z.string().min(1, "Date requise"),
  feedKg: z.string().regex(/^\d*([.,]\d+)?$/, "Nombre invalide").optional().or(z.literal("")),
  waterL: z.string().regex(/^\d*([.,]\d+)?$/, "Nombre invalide").optional().or(z.literal("")),
  observations: z.string().max(1000, "1000 caractères maximum").optional().or(z.literal("")),
});
type Form = z.infer<typeof schema>;
const DEFAULTS: Form = { recordDate: today(), feedKg: "", waterL: "", observations: "" };
const numField = (v?: string) => {
  const n = v ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

export function LayerDailyEntryDialog({
  open,
  onClose,
  farmId,
  unitId,
  existingDates,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  unitId: number;
  existingDates: string[];
}) {
  const { showToast } = useToast();
  const { hasInventory } = useInventoryGating();
  const [createRecord, { isLoading }] = useCreateDailyRecordMutation();
  const [consumption, setConsumption] = useState<StockConsumption | null>(null);
  const [formula, setFormula] = useState<FeedFormulaRef | null>(null);

  const { control, handleSubmit, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (open) reset(DEFAULTS);
  }, [open, reset]);

  const dateSet = useMemo(() => new Set(existingDates), [existingDates]);
  const watchedDate = useWatch({ control, name: "recordDate" });
  const isUpdate = !!watchedDate && dateSet.has(watchedDate);

  const onSubmit = async (values: Form) => {
    try {
      await createRecord({
        farmId,
        batchId: unitId,
        body: {
          recordDate: values.recordDate,
          mortalityCount: 0, // la mortalité pondeuse passe par l'onglet Pondeuses → Attrition
          feedKg: numField(values.feedKg),
          waterL: numField(values.waterL),
          observations: values.observations || undefined,
          feedConsumption: consumption ?? undefined,
          feedFormula: formula ?? undefined,
        },
      }).unwrap();
      showToast(isUpdate ? "Suivi mis à jour." : "Suivi enregistré.", "success");
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
            Suivi journalier
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Aliment et eau distribués (la mortalité se saisit dans l&apos;onglet Pondeuses).
          </Typography>
          <IconButton onClick={onClose} aria-label="Fermer" sx={{ position: "absolute", top: 12, right: 12 }}>
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
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today() } }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            {isUpdate && (
              <Alert severity="info" sx={{ py: 0.5 }}>
                Un suivi existe déjà pour cette date — il sera mis à jour.
              </Alert>
            )}
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
                  fullWidth
                  multiline
                  minRows={2}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            {hasInventory && (
              <FeedSourceSection
                farmId={farmId}
                open={open}
                onChange={(fc, ff) => {
                  setConsumption(fc);
                  setFormula(ff);
                }}
              />
            )}
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
