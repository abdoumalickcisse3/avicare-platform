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
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import {
  useCreateFarmMutation,
  useUpdateFarmMutation,
} from "@/store/api/farmsApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { useRefreshSession } from "@/hooks/useRefreshSession";
import { apiErrorMessage } from "@/lib/apiError";
import type { Farm, FarmInput } from "@/types";

const farmSchema = z.object({
  name: z.string().min(1, "Nom requis").max(200, "200 caractères maximum"),
  location: z
    .string()
    .max(500, "500 caractères maximum")
    .optional()
    .or(z.literal("")),
  capacity: z
    .string()
    .regex(/^\d*$/, "Saisissez un nombre")
    .optional()
    .or(z.literal("")),
});

type FarmForm = z.infer<typeof farmSchema>;

interface CreateFarmDialogProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the dialog edits this farm instead of creating a new one. */
  farm?: Farm;
}

/**
 * Create / edit farm dialog (A6-2 steps 4.5 & 4.6). Form limited to the fields
 * the backend accepts in V1 (name, location, capacity) — the Stitch design's
 * production-type toggle and photo upload are deferred (no backend support).
 */
export function CreateFarmDialog({ open, onClose, farm }: CreateFarmDialogProps) {
  const isEdit = Boolean(farm);
  const { showToast } = useToast();
  const refreshSession = useRefreshSession();
  const [createFarm, { isLoading: creating }] = useCreateFarmMutation();
  const [updateFarm, { isLoading: updating }] = useUpdateFarmMutation();
  const isLoading = creating || updating;

  const { control, handleSubmit, reset } = useForm<FarmForm>({
    resolver: zodResolver(farmSchema),
    defaultValues: { name: "", location: "", capacity: "" },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: farm?.name ?? "",
        location: farm?.location ?? "",
        capacity: farm?.capacity != null ? String(farm.capacity) : "",
      });
    }
  }, [open, farm, reset]);

  const onSubmit = async (values: FarmForm) => {
    const body: FarmInput = {
      name: values.name,
      location: values.location ? values.location : undefined,
      capacity: values.capacity ? Number(values.capacity) : undefined,
    };
    try {
      if (isEdit && farm) {
        await updateFarm({ id: farm.id, body }).unwrap();
        showToast("Ferme mise à jour.", "success");
      } else {
        await createFarm(body).unwrap();
        // Refresh so the token carries the new farm's OWNER membership (owner-only
        // actions like invite/subscription would otherwise 403 until next login).
        await refreshSession();
        showToast("Ferme créée avec succès.", "success");
      }
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
            {isEdit ? "Modifier la ferme" : "Créer une nouvelle ferme"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Renseignez les informations de votre exploitation.
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
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Nom de la ferme"
                  placeholder="Ex : Ferme Avicole du Saloum"
                  fullWidth
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="location"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Localisation"
                  placeholder="Ex : Thiès, Sénégal"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="capacity"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Capacité estimée (têtes)"
                  placeholder="Ex : 5000"
                  inputMode="numeric"
                  fullWidth
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
            startIcon={
              isLoading ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {isEdit ? "Enregistrer" : "Créer la ferme"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
