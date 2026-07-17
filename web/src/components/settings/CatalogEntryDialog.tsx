"use client";

import { useEffect, useMemo, useRef } from "react";
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
import type { CategoryConfig } from "@/constants/catalogCategories";
import type { CatalogEntry } from "@/store/api/catalogApi";
import { useOverrideCatalogEntryMutation } from "@/store/api/catalogApi";
import { slugify } from "@/lib/slug";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";

interface Props {
  open: boolean;
  onClose: () => void;
  config: CategoryConfig;
  farmId: number;
  entry?: CatalogEntry;
}

export function CatalogEntryDialog({ open, onClose, config, farmId, entry }: Props) {
  const { showToast } = useToast();
  const [override, { isLoading }] = useOverrideCatalogEntryMutation();

  // Editable fields = those without a const value.
  const editable = useMemo(
    () => config.fields.filter((f) => f.const === undefined),
    [config.fields],
  );

  const schema = useMemo(
    () =>
      z.object(
        Object.fromEntries(
          editable.map((f) => {
            if (f.type === "number") {
              // Held as a string in the form; validated numeric, coerced to a
              // number on submit.
              const numeric = (v: string | undefined) =>
                v === undefined || v === "" || !Number.isNaN(Number(v));
              return [
                f.name,
                f.required
                  ? z
                      .string()
                      .min(1, "Ce champ est requis")
                      .refine((v) => !Number.isNaN(Number(v)), "Entrez un nombre valide")
                  : z.string().optional().refine(numeric, "Entrez un nombre valide"),
              ];
            }
            return [
              f.name,
              f.required ? z.string().min(1, "Ce champ est requis") : z.string().optional(),
            ];
          }),
        ),
      ),
    [editable],
  );
  type FormValues = Record<string, string | undefined>;

  const defaults: FormValues = useMemo(() => {
    const out: FormValues = {};
    for (const f of editable) {
      const raw = entry?.value?.[f.name];
      out[f.name] = raw == null ? "" : String(raw);
    }
    return out;
  }, [editable, entry]);

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset(defaults);
    }
    wasOpen.current = open;
  }, [open, defaults, reset]);

  const onSubmit = async (values: FormValues) => {
    const consts = Object.fromEntries(
      config.fields.filter((f) => f.const !== undefined).map((f) => [f.name, f.const as string]),
    );
    // Number fields are stored as numbers (not the form's string); an empty
    // optional number is dropped from the value.
    const coerced: Record<string, unknown> = {};
    for (const f of editable) {
      const raw = values[f.name];
      coerced[f.name] =
        f.type === "number" ? (raw === undefined || raw === "" ? undefined : Number(raw)) : raw;
    }
    const value = { ...(entry?.value ?? {}), ...coerced, ...consts };
    const key = entry?.key ?? slugify(String(values[config.labelField] ?? ""));
    try {
      await override({ farmId, category: config.backendCategory, key, value }).unwrap();
      showToast(entry ? "Entrée mise à jour." : "Entrée ajoutée.", "success");
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
            {entry ? "Modifier l'entrée" : `Ajouter — ${config.title}`}
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
            {editable.map((f) => (
              <Controller
                key={f.name}
                name={f.name}
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    select={f.type === "select"}
                    type={f.type === "number" ? "number" : "text"}
                    label={f.label}
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  >
                    {f.type === "select" &&
                      (f.options ?? []).map((o) => (
                        <MenuItem key={o.value} value={o.value}>
                          {o.label}
                        </MenuItem>
                      ))}
                  </TextField>
                )}
              />
            ))}
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
            Enregistrer
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
