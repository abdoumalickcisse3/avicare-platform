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
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import { useGetCatalogQuery } from "@/store/api/catalogApi";
import { useGetProductionUnitsQuery } from "@/store/api/productionUnitsApi";
import { useCreateExpenseMutation, useUpdateExpenseMutation } from "@/store/api/financeApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import type { Expense, ExpenseInput } from "@/types";

/** ISO yyyy-mm-dd today helper for the expense-date default. */
const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  categoryKey: z.string().min(1, "Catégorie requise"),
  label: z.string().min(1, "Libellé requis"),
  amountXof: z
    .string()
    .regex(/^\d+$/, "Montant entier requis")
    .refine((v) => Number(v) > 0, "Le montant doit être supérieur à 0"),
  expenseDate: z.string().min(1, "Date requise"),
  notes: z.string().optional().or(z.literal("")),
  productionUnitId: z.string().optional().or(z.literal("")),
});

type ExpenseForm = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  farmId: number;
  expense?: Expense;
}

export function ExpenseDialog({ open, onClose, farmId, expense }: Props) {
  const { showToast } = useToast();
  const { data: categories = [] } = useGetCatalogQuery(
    { farmId, category: "expense_categories" },
    { skip: !open },
  );
  const { data: units = [] } = useGetProductionUnitsQuery({ farmId }, { skip: !open });
  const [createExpense, { isLoading: creating }] = useCreateExpenseMutation();
  const [updateExpense, { isLoading: updating }] = useUpdateExpenseMutation();
  const isLoading = creating || updating;

  const defaults = useMemo<ExpenseForm>(
    () => ({
      categoryKey: expense?.categoryKey ?? "",
      label: expense?.label ?? "",
      amountXof: expense ? String(expense.amountXof) : "",
      expenseDate: expense?.expenseDate ?? today(),
      notes: expense?.notes ?? "",
      productionUnitId: expense?.productionUnitId != null ? String(expense.productionUnitId) : "",
    }),
    [expense],
  );

  const { control, handleSubmit, reset } = useForm<ExpenseForm>({
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

  const onSubmit = async (values: ExpenseForm) => {
    const body: ExpenseInput = {
      categoryKey: values.categoryKey,
      label: values.label,
      amountXof: Number(values.amountXof),
      expenseDate: values.expenseDate,
      notes: values.notes || undefined,
      productionUnitId: values.productionUnitId ? Number(values.productionUnitId) : undefined,
    };
    try {
      if (expense) {
        await updateExpense({ farmId, id: expense.id, body }).unwrap();
        showToast("Dépense mise à jour.", "success");
      } else {
        await createExpense({ farmId, body }).unwrap();
        showToast("Dépense ajoutée.", "success");
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
            {expense ? "Modifier la dépense" : "Nouvelle dépense"}
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
              name="categoryKey"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  select
                  label="Catégorie"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                >
                  {categories.map((c) => (
                    <MenuItem key={c.key} value={c.key}>
                      {String(c.value.label ?? c.key)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
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
            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                name="amountXof"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Montant (XOF)"
                    fullWidth
                    slotProps={{
                      htmlInput: { inputMode: "numeric" },
                      input: { endAdornment: <InputAdornment position="end">XOF</InputAdornment> },
                    }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="expenseDate"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="date"
                    label="Date"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Box>
            <Controller
              name="productionUnitId"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Lot" fullWidth>
                  <MenuItem value="">Aucun lot</MenuItem>
                  {units.map((u) => (
                    <MenuItem key={u.id} value={String(u.id)}>
                      {u.name ?? `Lot #${u.id}`}
                    </MenuItem>
                  ))}
                </TextField>
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
