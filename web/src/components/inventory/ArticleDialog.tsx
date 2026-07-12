"use client";

import { useEffect } from "react";
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
import type { InventoryCatalogItem } from "@/types";
import {
  useCreateArticleMutation,
  useUpdateArticleMutation,
} from "@/store/api/inventoryCatalogApi";
import { INVENTORY_SUBCATEGORY_LABELS } from "@/lib/inventory";
import { slugify } from "@/lib/slug";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";

const schema = z.object({
  label: z.string().min(1, "Ce champ est requis"),
  subcategory: z.enum(["FEED", "CONSUMABLE", "EQUIPMENT", "PRODUCT"]),
  unit: z.string().optional(),
  price: z.string().regex(/^\d*$/, "Montant entier").optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  farmId: number;
  /** When set, the dialog edits this custom article (key is fixed). */
  article?: InventoryCatalogItem;
}

export function ArticleDialog({ open, onClose, farmId, article }: Props) {
  const { showToast } = useToast();
  const [createArticle, { isLoading: creating }] = useCreateArticleMutation();
  const [updateArticle, { isLoading: updating }] = useUpdateArticleMutation();
  const isEdit = article != null;

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { label: "", subcategory: "FEED", unit: "", price: "" },
  });

  // Edge-trigger reset on open (fresh fields per opening; prefilled in edit mode).
  useEffect(() => {
    if (open) {
      reset({
        label: article?.label ?? "",
        subcategory: (article?.subcategory as FormValues["subcategory"]) ?? "FEED",
        unit: article?.unit ?? "",
        price: article?.typicalUnitPriceXof != null ? String(article.typicalUnitPriceXof) : "",
      });
    }
  }, [open, article, reset]);

  const onSubmit = async (values: FormValues) => {
    const value: Record<string, unknown> = {
      label: values.label,
      subcategory: values.subcategory,
    };
    if (values.unit) value.unit = values.unit;
    if (values.price) value.typical_unit_price_xof = Number(values.price);
    const key = isEdit ? article!.articleKey : slugify(values.label);
    try {
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
