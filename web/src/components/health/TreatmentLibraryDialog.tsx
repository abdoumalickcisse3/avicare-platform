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
import { useSaveMedicationMutation } from "@/store/api/inventoryCatalogApi";
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
  unit: z.string().optional(),
  price: z.string().regex(/^\d*$/, "Montant entier").optional(),
});
type FormValues = z.infer<typeof schema>;

const ROUTE_KEYS = Object.keys(HEALTH_ROUTE_LABELS);

interface Props {
  open: boolean;
  onClose: () => void;
  farmId: number;
  treatment?: Treatment;
  /** When set (and `treatment` is not), pre-fills the form from a platform treatment to clone. */
  cloneFrom?: Treatment;
  existingKeys?: string[];
}

export function TreatmentLibraryDialog({
  open,
  onClose,
  farmId,
  treatment,
  cloneFrom,
  existingKeys = [],
}: Props) {
  const { showToast } = useToast();
  const [saveMedication, { isLoading: saving }] = useSaveMedicationMutation();
  const isEdit = treatment != null;
  const source = treatment ?? cloneFrom;

  const { control, handleSubmit, reset, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: "",
      molecule: "",
      routes: [],
      withdrawalMeat: "",
      withdrawalEggs: "",
      unit: "",
      price: "",
    },
  });

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset({
        label: source?.label ?? "",
        molecule: source?.molecule ?? "",
        routes: source?.routes ?? [],
        withdrawalMeat:
          source?.withdrawalDaysMeat != null ? String(source.withdrawalDaysMeat) : "",
        withdrawalEggs:
          source?.withdrawalDaysEggs != null ? String(source.withdrawalDaysEggs) : "",
        unit: "",
        price: "",
      });
    }
    wasOpen.current = open;
  }, [open, source, reset]);

  const onSubmit = async (values: FormValues) => {
    const key = isEdit ? treatment!.key : slugify(values.label);
    if (!isEdit && existingKeys.includes(key)) {
      setError("label", { message: "Un traitement avec ce nom existe déjà" });
      return;
    }
    try {
      // One product, two faces (ADR-020): writing the medical sheet alone left the farmer with a
      // treatment they could never buy, receive or decrement — so the stock article goes with it.
      await saveMedication({
        farmId,
        body: {
          key,
          label: values.label,
          molecule: values.molecule || undefined,
          routes: values.routes,
          withdrawalDaysMeat: values.withdrawalMeat ? Number(values.withdrawalMeat) : undefined,
          withdrawalDaysEggs: values.withdrawalEggs ? Number(values.withdrawalEggs) : undefined,
          unit: values.unit || undefined,
          typicalUnitPriceXof: values.price ? Number(values.price) : undefined,
        },
      }).unwrap();
      showToast(isEdit ? "Traitement modifié" : "Traitement créé", "success");
      onClose();
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {isEdit ? "Modifier le traitement" : cloneFrom ? "Cloner le traitement" : "Nouveau traitement"}
      </DialogTitle>
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
            <Box sx={{ display: "flex", gap: 2 }}>
              <Controller
                name="unit"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Unité de stock" placeholder="L, flacon, sachet…" fullWidth />
                )}
              />
              <Controller
                name="price"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Prix moyen (XOF)"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="contained" disabled={saving}>
            Enregistrer
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
