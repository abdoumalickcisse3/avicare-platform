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
import { Bird, X } from "lucide-react";
import { useDeclareBreedMutation } from "@/store/api/breedsApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { colors } from "@/theme/tokens";
import type { BreedProfile } from "@/types";

/**
 * French labels for the four production profiles — the same vocabulary the backend catalogue
 * (`breed_profiles`, migration V69) carries, so this screen never invents its own wording.
 */
export const BREED_PROFILE_LABELS: Record<BreedProfile, string> = {
  BROILER_FAST: "Chair à croissance rapide",
  BROILER_RUSTIC: "Chair rustique (croissance lente)",
  LAYER_INDUSTRIAL: "Ponte industrielle",
  LAYER_RUSTIC: "Ponte rustique (locale améliorée)",
};

const BREED_PROFILES: BreedProfile[] = [
  "BROILER_FAST",
  "BROILER_RUSTIC",
  "LAYER_INDUSTRIAL",
  "LAYER_RUSTIC",
];

const schema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(200, "200 caractères maximum"),
  profile: z.string().refine((v) => BREED_PROFILES.includes(v as BreedProfile), "Profil requis"),
});

type BreedForm = z.infer<typeof schema>;

const DEFAULTS: BreedForm = { name: "", profile: "" };

/**
 * Lets a farmer declare a breed the platform catalogue does not have (Goliath, Kuroiler, "locale
 * améliorée"...). Only sends a name and a profile — never a code: the backend computes it
 * (slugify) from the name, and a divergent client-side slugify once created two catalog entries
 * for one product (PR #491).
 */
export function BreedDialog({
  open,
  onClose,
  farmId,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
}) {
  const { showToast } = useToast();
  const [declareBreed, { isLoading }] = useDeclareBreedMutation();

  const { control, handleSubmit, reset } = useForm<BreedForm>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (open) reset(DEFAULTS);
  }, [open, reset]);

  const onSubmit = async (values: BreedForm) => {
    try {
      await declareBreed({
        farmId,
        body: { name: values.name, profile: values.profile as BreedProfile },
      }).unwrap();
      showToast("Souche déclarée.", "success");
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
            Déclarer une souche
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
            <Typography variant="body2" color="text.secondary">
              Pour une souche absente du catalogue (Goliath, Kuroiler, locale améliorée…).
              Indiquez son nom et le profil le plus proche : il détermine les cibles par défaut et
              si une courbe de croissance de référence peut être tracée.
            </Typography>
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Nom de la souche"
                  placeholder="Ex : Goliath"
                  fullWidth
                  required
                  autoFocus
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="profile"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  select
                  label="Profil"
                  fullWidth
                  required
                  error={!!fieldState.error}
                  helperText={
                    fieldState.error?.message ??
                    "Détermine les cibles par défaut et la référence de croissance."
                  }
                >
                  <MenuItem value="" disabled>
                    Sélectionner un profil
                  </MenuItem>
                  {BREED_PROFILES.map((p) => (
                    <MenuItem key={p} value={p}>
                      {BREED_PROFILE_LABELS[p]}
                    </MenuItem>
                  ))}
                </TextField>
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
            color="secondary"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <Bird size={18} />}
            sx={{ bgcolor: colors.primary[600] }}
          >
            Déclarer la souche
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
