"use client";

import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import type { Vaccine } from "@/types";
import { useCreateVaccineMutation, useUpdateVaccineMutation } from "@/store/api/healthApi";
import { HEALTH_ROUTE_LABELS } from "@/lib/health";
import { slugify } from "@/lib/slug";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";

const schema = z.object({
  label: z.string().min(1, "Ce champ est requis"),
  disease: z.string().optional(),
  route: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  farmId: number;
  /** When set, edits this custom vaccine (key is fixed). */
  vaccine?: Vaccine;
  /** All farm-visible vaccine keys — used to reject duplicate creates. */
  existingKeys?: string[];
}

export function VaccineLibraryDialog({ open, onClose, farmId, vaccine, existingKeys = [] }: Props) {
  const { showToast } = useToast();
  const [createVaccine, { isLoading: creating }] = useCreateVaccineMutation();
  const [updateVaccine, { isLoading: updating }] = useUpdateVaccineMutation();
  const isEdit = vaccine != null;

  const { control, handleSubmit, reset, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { label: "", disease: "", route: "" },
  });

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset({
        label: vaccine?.label ?? "",
        disease: vaccine?.disease ?? "",
        route: vaccine?.route ?? "",
      });
    }
    wasOpen.current = open;
  }, [open, vaccine, reset]);

  const onSubmit = async (values: FormValues) => {
    const value: Record<string, unknown> = { label: values.label };
    if (values.disease) value.disease = values.disease;
    if (values.route) value.route = values.route;
    const key = isEdit ? vaccine!.key : slugify(values.label);
    if (!isEdit && existingKeys.includes(key)) {
      setError("label", { message: "Un vaccin avec ce nom existe déjà" });
      return;
    }
    try {
      if (isEdit) await updateVaccine({ farmId, key, value }).unwrap();
      else await createVaccine({ farmId, key, value }).unwrap();
      showToast(isEdit ? "Vaccin modifié" : "Vaccin créé", "success");
      onClose();
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? "Modifier le vaccin" : "Nouveau vaccin"}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Controller
              name="label"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Nom"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="disease"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Maladie ciblée" fullWidth />
              )}
            />
            <Controller
              name="route"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Voie" fullWidth>
                  <MenuItem value="">—</MenuItem>
                  {Object.entries(HEALTH_ROUTE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="contained" disabled={creating || updating}>
            Enregistrer
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
