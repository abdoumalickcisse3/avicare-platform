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
import { useCreateProductionUnitMutation } from "@/store/api/productionUnitsApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
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
  notes: z.string().max(2000, "2000 caractères maximum").optional().or(z.literal("")),
});

type LayerBatchForm = z.infer<typeof schema>;

const DEFAULTS: LayerBatchForm = {
  name: "",
  breedId: "",
  startDate: today(),
  initialCount: "",
  notes: "",
};

function SectionLabel({ color, children }: { color: string; children: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Box sx={{ width: 4, height: 16, borderRadius: 1, bgcolor: color }} />
      <Typography sx={{ fontWeight: 600 }}>{children}</Typography>
    </Stack>
  );
}

export function CreateLayerBatchDialog({
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
  const [createUnit, { isLoading }] = useCreateProductionUnitMutation();

  const { control, handleSubmit, reset } = useForm<LayerBatchForm>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (open) reset(DEFAULTS);
  }, [open, reset]);

  // Only layer strains (ISA Brown, Lohmann, Hy-Line) — never broiler ones.
  const layerBreeds = (breeds ?? []).filter(
    (b) => b.species === "POULTRY" && b.type === "layer" && b.active,
  );

  const onSubmit = async (values: LayerBatchForm) => {
    try {
      await createUnit({
        farmId,
        body: {
          breedId: Number(values.breedId),
          name: values.name || undefined,
          unitKind: "BATCH",
          initialCount: Number(values.initialCount),
          startDate: values.startDate,
          notes: values.notes || undefined,
        },
      }).unwrap();
      showToast("Lot de pondeuses créé avec succès.", "success");
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
            Créer un nouveau lot de pondeuses
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
                  placeholder="Ex : Bâtiment B - Lot 12"
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
                  label="Souche de pondeuse"
                  fullWidth
                  required
                  error={!!fieldState.error}
                  helperText={
                    fieldState.error?.message ??
                    (layerBreeds.length === 0
                      ? "Aucune souche de ponte disponible."
                      : "Races de ponte uniquement.")
                  }
                >
                  <MenuItem value="" disabled>
                    Sélectionner une souche
                  </MenuItem>
                  {layerBreeds.map((b) => (
                    <MenuItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <SectionLabel color={colors.primary[500]}>Démarrage</SectionLabel>
            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                name="startDate"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="date"
                    label="Date d'entrée"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today() } }}
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

            <Controller
              name="notes"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Notes"
                  placeholder="Bâtiment, provenance, observations…"
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
            Créer le lot
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
