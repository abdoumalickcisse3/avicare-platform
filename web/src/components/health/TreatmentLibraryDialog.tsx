"use client";

import { useEffect, useRef } from "react";
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
  Stack,
  TextField,
} from "@mui/material";
import type { Treatment } from "@/types";
import {
  useCreateTreatmentCatalogMutation,
  useUpdateTreatmentCatalogMutation,
} from "@/store/api/healthApi";
import { HEALTH_ROUTE_LABELS, routeLabel } from "@/lib/health";
import { slugify } from "@/lib/slug";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";

const schema = z.object({
  label: z.string().min(1, "Ce champ est requis"),
  molecule: z.string().optional(),
  routes: z.array(z.string()),
  withdrawalMeat: z.string().regex(/^\d*$/, "Entier").optional(),
  withdrawalEggs: z.string().regex(/^\d*$/, "Entier").optional(),
});
type FormValues = z.infer<typeof schema>;

const ROUTE_KEYS = Object.keys(HEALTH_ROUTE_LABELS);

interface Props {
  open: boolean;
  onClose: () => void;
  farmId: number;
  treatment?: Treatment;
  existingKeys?: string[];
}

export function TreatmentLibraryDialog({
  open,
  onClose,
  farmId,
  treatment,
  existingKeys = [],
}: Props) {
  const { showToast } = useToast();
  const [createTreatment, { isLoading: creating }] = useCreateTreatmentCatalogMutation();
  const [updateTreatment, { isLoading: updating }] = useUpdateTreatmentCatalogMutation();
  const isEdit = treatment != null;

  const { control, handleSubmit, reset, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { label: "", molecule: "", routes: [], withdrawalMeat: "", withdrawalEggs: "" },
  });

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset({
        label: treatment?.label ?? "",
        molecule: treatment?.molecule ?? "",
        routes: treatment?.routes ?? [],
        withdrawalMeat:
          treatment?.withdrawalDaysMeat != null ? String(treatment.withdrawalDaysMeat) : "",
        withdrawalEggs:
          treatment?.withdrawalDaysEggs != null ? String(treatment.withdrawalDaysEggs) : "",
      });
    }
    wasOpen.current = open;
  }, [open, treatment, reset]);

  const onSubmit = async (values: FormValues) => {
    const value: Record<string, unknown> = { label: values.label };
    if (values.molecule) value.molecule = values.molecule;
    if (values.routes.length) value.routes = values.routes;
    if (values.withdrawalMeat) value.withdrawal_days_meat = Number(values.withdrawalMeat);
    if (values.withdrawalEggs) value.withdrawal_days_eggs = Number(values.withdrawalEggs);
    const key = isEdit ? treatment!.key : slugify(values.label);
    if (!isEdit && existingKeys.includes(key)) {
      setError("label", { message: "Un traitement avec ce nom existe déjà" });
      return;
    }
    try {
      if (isEdit) await updateTreatment({ farmId, key, value }).unwrap();
      else await createTreatment({ farmId, key, value }).unwrap();
      showToast(isEdit ? "Traitement modifié" : "Traitement créé", "success");
      onClose();
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? "Modifier le traitement" : "Nouveau traitement"}</DialogTitle>
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
              name="molecule"
              control={control}
              render={({ field }) => <TextField {...field} label="Molécule" fullWidth />}
            />
            <Controller
              name="routes"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  multiple
                  options={ROUTE_KEYS}
                  getOptionLabel={(o) => routeLabel(o)}
                  value={field.value}
                  onChange={(_e, v) => field.onChange(v)}
                  renderInput={(params) => <TextField {...params} label="Voie(s)" />}
                />
              )}
            />
            <Box sx={{ display: "flex", gap: 2 }}>
              <Controller
                name="withdrawalMeat"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Délai viande (j)"
                    type="number"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
                  />
                )}
              />
              <Controller
                name="withdrawalEggs"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Délai œufs (j)"
                    type="number"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
                  />
                )}
              />
            </Box>
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
