"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
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
import { useCreateWeighingMutation } from "@/store/api/poultryBatchesApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { colors } from "@/theme/tokens";

const today = () => new Date().toISOString().slice(0, 10);

/** Parse a free-text list of weights ("1850, 1920 2010") into positive numbers. */
function parseWeights(raw: string): number[] {
  return raw
    .split(/[\s,;]+/)
    .map((t) => Number(t.replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0);
}

interface Stats {
  count: number;
  avg: number;
  min: number;
  max: number;
  std: number;
  uniformity: number;
}

/** Mean, range, population std-dev and uniformity (% within ±10% of mean). */
function computeStats(weights: number[]): Stats | null {
  if (weights.length === 0) return null;
  const count = weights.length;
  const avg = weights.reduce((s, w) => s + w, 0) / count;
  const variance = weights.reduce((s, w) => s + (w - avg) ** 2, 0) / count;
  const std = Math.sqrt(variance);
  const within = weights.filter((w) => Math.abs(w - avg) <= avg * 0.1).length;
  return {
    count,
    avg,
    min: Math.min(...weights),
    max: Math.max(...weights),
    std,
    uniformity: (within / count) * 100,
  };
}

const schema = z.object({
  sampleDate: z.string().min(1, "Date requise"),
  weights: z
    .string()
    .refine((v) => parseWeights(v).length >= 2, "Saisissez au moins 2 poids"),
  notes: z.string().max(1000, "1000 caractères maximum").optional().or(z.literal("")),
});

type WeighingForm = z.infer<typeof schema>;

const DEFAULTS: WeighingForm = {
  sampleDate: today(),
  weights: "",
  notes: "",
};

const monoSx = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
} as const;

function StatBox({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <Box sx={{ textAlign: "center", minWidth: 64 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {label}
      </Typography>
      <Typography sx={{ ...monoSx, fontSize: "1.05rem", color: colors.neutral[800] }}>
        {value}
        {unit && (
          <Box component="span" sx={{ fontSize: "0.7rem", ml: 0.25, color: colors.neutral[500] }}>
            {unit}
          </Box>
        )}
      </Typography>
    </Box>
  );
}

export function WeighingDialog({
  open,
  onClose,
  farmId,
  batchId,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  batchId: number;
}) {
  const { showToast } = useToast();
  const [createWeighing, { isLoading }] = useCreateWeighingMutation();

  const { control, handleSubmit, reset } = useForm<WeighingForm>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (open) reset(DEFAULTS);
  }, [open, reset]);

  const rawWeights = useWatch({ control, name: "weights" });
  const stats = useMemo(() => computeStats(parseWeights(rawWeights ?? "")), [rawWeights]);

  const onSubmit = async (values: WeighingForm) => {
    try {
      await createWeighing({
        farmId,
        batchId,
        body: {
          sampleDate: values.sampleDate,
          individualWeights: parseWeights(values.weights),
          notes: values.notes || undefined,
        },
      }).unwrap();
      showToast("Pesée enregistrée avec succès.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle component="div" sx={{ pr: 6 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Nouvelle pesée
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Pesez un échantillon de sujets ; les statistiques sont calculées
            automatiquement.
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
              name="sampleDate"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Date de la pesée"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today() } }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <Controller
              name="weights"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Poids individuels (g)"
                  placeholder="1850, 1920, 2010, 1880…"
                  fullWidth
                  multiline
                  minRows={2}
                  slotProps={{ htmlInput: { inputMode: "decimal" } }}
                  error={!!fieldState.error}
                  helperText={
                    fieldState.error?.message ??
                    "Séparez chaque poids par une virgule ou un espace."
                  }
                />
              )}
            />

            {stats && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: colors.primary[50],
                  border: `1px solid ${colors.primary[100]}`,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 600, color: colors.primary[700], display: "block", mb: 1 }}
                >
                  Aperçu — {stats.count} sujets pesés
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 2,
                    justifyContent: "space-between",
                  }}
                >
                  <StatBox label="Moyenne" value={String(Math.round(stats.avg))} unit="g" />
                  <StatBox label="Min" value={String(Math.round(stats.min))} unit="g" />
                  <StatBox label="Max" value={String(Math.round(stats.max))} unit="g" />
                  <StatBox label="Écart-type" value={stats.std.toFixed(1)} unit="g" />
                  <StatBox label="Uniformité" value={Math.round(stats.uniformity).toString()} unit="%" />
                </Box>
              </Box>
            )}

            <Controller
              name="notes"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Notes"
                  placeholder="Conditions de pesée, remarques…"
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
            Enregistrer la pesée
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
