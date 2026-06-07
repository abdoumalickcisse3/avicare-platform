"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
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
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import { useGetBreedsQuery } from "@/store/api/breedsApi";
import { useCreateBatchMutation } from "@/store/api/poultryBatchesApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { targetsForBreed } from "@/constants/breedDefaults";
import { colors } from "@/theme/tokens";

const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  name: z.string().max(200, "200 caractères maximum").optional().or(z.literal("")),
  breedId: z.string().refine((v) => Number(v) > 0, "Souche requise"),
  startDate: z.string().min(1, "Date requise"),
  initialCount: z
    .string()
    .regex(/^\d+$/, "Effectif requis")
    .refine((v) => Number(v) > 0, "Effectif requis"),
  targetWeightG: z.string().regex(/^\d+$/, "Nombre invalide"),
  targetAgeDays: z.string().regex(/^\d+$/, "Nombre invalide"),
});

type BatchForm = z.infer<typeof schema>;

const DEFAULTS: BatchForm = {
  name: "",
  breedId: "",
  startDate: today(),
  initialCount: "",
  targetWeightG: "2000",
  targetAgeDays: "42",
};

function SectionLabel({ color, children }: { color: string; children: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Box sx={{ width: 4, height: 16, borderRadius: 1, bgcolor: color }} />
      <Typography sx={{ fontWeight: 600 }}>{children}</Typography>
    </Stack>
  );
}

export function CreateBatchDialog({
  open,
  onClose,
  farmId,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
}) {
  const { showToast } = useToast();
  const { data: breeds } = useGetBreedsQuery();
  const [createBatch, { isLoading }] = useCreateBatchMutation();

  const { control, handleSubmit, reset, setValue } = useForm<BatchForm>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (open) reset(DEFAULTS);
  }, [open, reset]);

  const poultryBreeds = (breeds ?? []).filter((b) => b.species === "POULTRY" && b.active);

  const onBreedChange = (breedId: number) => {
    const breed = poultryBreeds.find((b) => b.id === breedId);
    const targets = targetsForBreed(breed?.code);
    setValue("targetWeightG", String(targets.targetWeightG));
    setValue("targetAgeDays", String(targets.targetAgeDays));
  };

  const onSubmit = async (values: BatchForm) => {
    try {
      await createBatch({
        farmId,
        body: {
          breedId: Number(values.breedId),
          name: values.name || undefined,
          startDate: values.startDate,
          initialCount: Number(values.initialCount),
          targetWeightG: Number(values.targetWeightG),
          targetAgeDays: Number(values.targetAgeDays),
        },
      }).unwrap();
      showToast("Lot créé avec succès.", "success");
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
            Créer un nouveau lot de volaille chair
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
            <SectionLabel color={colors.primary[500]}>Informations</SectionLabel>
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Nom du lot"
                  placeholder="Ex : Lot_Mbour_Mars_2024"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="breedId"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  select
                  label="Souche de volaille"
                  fullWidth
                  required
                  error={!!fieldState.error}
                  helperText={
                    fieldState.error?.message ??
                    "Standard de croissance sélectionné automatiquement."
                  }
                  onChange={(e) => {
                    field.onChange(e);
                    onBreedChange(Number(e.target.value));
                  }}
                >
                  <MenuItem value="" disabled>
                    Sélectionner une souche
                  </MenuItem>
                  {poultryBreeds.map((b) => (
                    <MenuItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <SectionLabel color={colors.primary[500]}>Démarrage</SectionLabel>
            <Box
              sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}
            >
              <Controller
                name="startDate"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="date"
                    label="Date d'arrivée"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="initialCount"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Effectif initial (têtes)"
                    fullWidth
                    required
                    slotProps={{ htmlInput: { inputMode: "numeric", min: 1 } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Box>

            <SectionLabel color={colors.accent[400]}>Objectifs de sortie</SectionLabel>
            <Box
              sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}
            >
              <Controller
                name="targetWeightG"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Poids cible (g)"
                    fullWidth
                    slotProps={{ htmlInput: { inputMode: "numeric", min: 1 } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="targetAgeDays"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Âge cible (jours)"
                    fullWidth
                    slotProps={{ htmlInput: { inputMode: "numeric", min: 1 } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Box>
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
            startIcon={
              isLoading ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            Créer le lot
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
