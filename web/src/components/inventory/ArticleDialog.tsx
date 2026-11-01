"use client";

import { useEffect, useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import type { InventoryCatalogItem } from "@/types";
import {
  useCreateArticleMutation,
  useSaveMedicationMutation,
  useUpdateArticleMutation,
} from "@/store/api/inventoryCatalogApi";
import { INVENTORY_SUBCATEGORY_LABELS } from "@/lib/inventory";
import { slugify } from "@/lib/slug";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";

const schema = z.object({
  label: z.string().min(1, "Ce champ est requis"),
  subcategory: z.enum(["FEED", "CONSUMABLE", "EQUIPMENT", "PRODUCT", "MEDICATION"]),
  unit: z.string().optional(),
  price: z.string().regex(/^\d*$/, "Montant entier").optional(),
  molecule: z.string().optional(),
  withdrawalMeat: z.string().regex(/^\d*$/, "Entier").optional(),
  withdrawalEggs: z.string().regex(/^\d*$/, "Entier").optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  farmId: number;
  /** When set, the dialog edits this custom article (key is fixed). */
  article?: InventoryCatalogItem;
  /** Existing article keys (all farm-visible articles) — used to reject duplicate creates. */
  existingKeys?: string[];
}

export function ArticleDialog({ open, onClose, farmId, article, existingKeys = [] }: Props) {
  const { showToast } = useToast();
  const [createArticle, { isLoading: creating }] = useCreateArticleMutation();
  const [updateArticle, { isLoading: updating }] = useUpdateArticleMutation();
  const [saveMedication, { isLoading: savingMedication }] = useSaveMedicationMutation();
  const isEdit = article != null;

  const { control, handleSubmit, reset, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: "",
      subcategory: "FEED",
      unit: "",
      price: "",
      molecule: "",
      withdrawalMeat: "",
      withdrawalEggs: "",
    },
  });

  // The medical fields only exist on a medication, and they decide the farmer's legal sale dates.
  const subcategory = useWatch({ control, name: "subcategory" });
  const isMedication = subcategory === "MEDICATION";

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset({
        label: article?.label ?? "",
        subcategory: (article?.subcategory as FormValues["subcategory"]) ?? "FEED",
        unit: article?.unit ?? "",
        price: article?.typicalUnitPriceXof != null ? String(article.typicalUnitPriceXof) : "",
        molecule: "",
        withdrawalMeat: "",
        withdrawalEggs: "",
      });
    }
    wasOpen.current = open;
  }, [open, article, reset]);

  const onSubmit = async (values: FormValues) => {
    const key = isEdit ? article!.articleKey : slugify(values.label);
    if (!isEdit && existingKeys.includes(key)) {
      setError("label", { message: "Un article avec ce nom existe déjà" });
      return;
    }
    try {
      if (values.subcategory === "MEDICATION") {
        // One product, two faces (ADR-020): the bridge writes the stock article AND the medical
        // sheet the treatment form reads, so a medication bought into stock is treatable.
        const saved = await saveMedication({
          farmId,
          body: {
            key,
            label: values.label,
            unit: values.unit || undefined,
            typicalUnitPriceXof: values.price ? Number(values.price) : undefined,
            molecule: values.molecule || undefined,
            routes: [],
            withdrawalDaysMeat: values.withdrawalMeat ? Number(values.withdrawalMeat) : undefined,
            withdrawalDaysEggs: values.withdrawalEggs ? Number(values.withdrawalEggs) : undefined,
          },
        }).unwrap();
        showToast(
          saved.medicalSheetWritten
            ? "Médicament enregistré — disponible au stock et à l'enregistrement d'un traitement."
            : "Médicament enregistré au stock. Le module Sanitaire avancé est inactif : il n'apparaîtra pas dans les traitements.",
          saved.medicalSheetWritten ? "success" : "info",
        );
        onClose();
        return;
      }
      const value: Record<string, unknown> = {
        label: values.label,
        subcategory: values.subcategory,
      };
      if (values.unit) value.unit = values.unit;
      if (values.price) value.typical_unit_price_xof = Number(values.price);
      if (isEdit) await updateArticle({ farmId, key, value }).unwrap();
      else await createArticle({ farmId, key, value }).unwrap();
      showToast(isEdit ? "Article modifié" : "Article créé", "success");
      onClose();
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? "Modifier l'article" : "Nouvel article"}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Controller
              name="label"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Libellé"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="subcategory"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Sous-catégorie" fullWidth>
                  {Object.entries(INVENTORY_SUBCATEGORY_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="unit"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Unité" placeholder="kg, sac, unité…" fullWidth />
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
            {isMedication && (
              <>
                <Controller
                  name="molecule"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Molécule"
                      placeholder="amoxicilline, sorbitol…"
                      fullWidth
                    />
                  )}
                />
                <Controller
                  name="withdrawalMeat"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      label="Délai viande (jours)"
                      fullWidth
                      slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
                      error={!!fieldState.error}
                      helperText={
                        fieldState.error?.message ??
                        "Délai d'attente légal avant de vendre la viande."
                      }
                    />
                  )}
                />
                <Controller
                  name="withdrawalEggs"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      label="Délai œufs (jours)"
                      fullWidth
                      slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
                      error={!!fieldState.error}
                      helperText={
                        fieldState.error?.message ??
                        "Délai d'attente légal avant de vendre les œufs."
                      }
                    />
                  )}
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="contained" disabled={creating || updating || savingMedication}>
            Enregistrer
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
