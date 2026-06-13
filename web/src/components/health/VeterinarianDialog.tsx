"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Stethoscope, X } from "lucide-react";
import {
  useCreateVeterinarianMutation,
  useUpdateVeterinarianMutation,
} from "@/store/api/healthApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { colors } from "@/theme/tokens";
import { SectionLabel } from "./HealthDialogParts";
import type { Veterinarian } from "@/types";

const schema = z.object({
  fullName: z.string().min(1, "Nom requis").max(150),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email("Email invalide").max(120).optional().or(z.literal("")),
  speciality: z.string().max(100).optional().or(z.literal("")),
  licenseNumber: z.string().max(80).optional().or(z.literal("")),
  location: z.string().max(150).optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

type VetForm = z.infer<typeof schema>;

export function VeterinarianDialog({
  open,
  onClose,
  farmId,
  veterinarian,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  /** When set, the dialog edits this entry; otherwise it creates a new one. */
  veterinarian?: Veterinarian | null;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { showToast } = useToast();
  const [createVet, createState] = useCreateVeterinarianMutation();
  const [updateVet, updateState] = useUpdateVeterinarianMutation();
  const isEdit = !!veterinarian;

  const defaults = useMemo<VetForm>(
    () => ({
      fullName: veterinarian?.fullName ?? "",
      phone: veterinarian?.phone ?? "",
      email: veterinarian?.email ?? "",
      speciality: veterinarian?.speciality ?? "",
      licenseNumber: veterinarian?.licenseNumber ?? "",
      location: veterinarian?.location ?? "",
      notes: veterinarian?.notes ?? "",
    }),
    [veterinarian],
  );

  const { control, handleSubmit, reset } = useForm<VetForm>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
  }, [open, reset, defaults]);

  const onSubmit = async (values: VetForm) => {
    const body = {
      fullName: values.fullName,
      phone: values.phone || undefined,
      email: values.email || undefined,
      speciality: values.speciality || undefined,
      licenseNumber: values.licenseNumber || undefined,
      location: values.location || undefined,
      notes: values.notes || undefined,
    };
    try {
      if (isEdit) {
        await updateVet({ farmId, id: veterinarian!.id, body }).unwrap();
        showToast("Vétérinaire mis à jour.", "success");
      } else {
        await createVet({ farmId, body }).unwrap();
        showToast("Vétérinaire ajouté.", "success");
      }
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
            {isEdit ? "Modifier le vétérinaire" : "Nouveau vétérinaire"}
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
            <SectionLabel color={colors.vet.main}>Identité</SectionLabel>
            <Controller
              name="fullName"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Nom complet"
                  fullWidth
                  required
                  autoFocus
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                name="speciality"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Spécialité" placeholder="Aviaire" fullWidth />
                )}
              />
              <Controller
                name="licenseNumber"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="N° d'ordre" fullWidth />
                )}
              />
            </Box>

            <SectionLabel color={colors.vet.main}>Contact</SectionLabel>
            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Téléphone"
                    fullWidth
                    slotProps={{ htmlInput: { inputMode: "tel" } }}
                  />
                )}
              />
              <Controller
                name="email"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Email"
                    type="email"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Box>
            <Controller
              name="location"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Localisation" placeholder="Ville / région" fullWidth />
              )}
            />
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Notes" fullWidth multiline minRows={2} />
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
            disabled={createState.isLoading || updateState.isLoading}
            startIcon={<Stethoscope size={18} />}
          >
            {isEdit ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
