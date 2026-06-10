"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import {
  useAdjustTrayStockMutation,
  useUpdateTrayStockMutation,
} from "@/store/api/eggProductionApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import type { TrayStock } from "@/types";

type Mode = "adjust" | "set";

interface StockForm {
  mode: Mode;
  full: string;
  empty: string;
}

const intOrZero = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Tray stock editor. "Ajuster" adds/removes deltas (FARMER+); "Définir" sets the
 * absolute counts (MANAGER+). A backend 403 on "Définir" surfaces as a toast.
 */
export function TrayStockDialog({
  open,
  onClose,
  farmId,
  current,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  current: TrayStock | undefined;
}) {
  const { showToast } = useToast();
  const [adjustStock, { isLoading: adjusting }] = useAdjustTrayStockMutation();
  const [setStock, { isLoading: setting }] = useUpdateTrayStockMutation();
  const isLoading = adjusting || setting;

  const { control, handleSubmit, reset, setValue } = useForm<StockForm>({
    defaultValues: { mode: "adjust", full: "", empty: "" },
  });

  useEffect(() => {
    if (open) reset({ mode: "adjust", full: "", empty: "" });
  }, [open, reset]);

  const mode = useWatch({ control, name: "mode" });

  // Switching mode is a user event — prefill "Définir" with the current counts,
  // clear back to empty deltas for "Ajuster".
  const onModeChange = (next: Mode | null) => {
    if (!next) return;
    setValue("mode", next);
    if (next === "set" && current) {
      setValue("full", String(current.fullTraysCount));
      setValue("empty", String(current.emptyTraysCount));
    } else {
      setValue("full", "");
      setValue("empty", "");
    }
  };

  const onSubmit = async (values: StockForm) => {
    try {
      if (values.mode === "adjust") {
        await adjustStock({
          farmId,
          body: { fullDelta: intOrZero(values.full), emptyDelta: intOrZero(values.empty) },
        }).unwrap();
      } else {
        await setStock({
          farmId,
          body: {
            fullTraysCount: intOrZero(values.full),
            emptyTraysCount: intOrZero(values.empty),
          },
        }).unwrap();
      }
      showToast("Stock de plateaux mis à jour.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle component="div" sx={{ pr: 6 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Stock de plateaux
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
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={mode}
              onChange={(_e, v: Mode | null) => onModeChange(v)}
            >
              <ToggleButton value="adjust">Ajuster (±)</ToggleButton>
              <ToggleButton value="set">Définir</ToggleButton>
            </ToggleButtonGroup>

            <Typography variant="body2" color="text.secondary">
              {mode === "adjust"
                ? "Ajoutez ou retirez des plateaux (valeurs négatives autorisées)."
                : "Saisissez le nombre exact de plateaux en stock."}
            </Typography>

            <Box sx={{ display: "flex", gap: 2 }}>
              <Controller
                name="full"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label={mode === "adjust" ? "Pleins (±)" : "Pleins"}
                    fullWidth
                    slotProps={{
                      htmlInput: {
                        inputMode: "numeric",
                        min: mode === "set" ? 0 : undefined,
                      },
                    }}
                  />
                )}
              />
              <Controller
                name="empty"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label={mode === "adjust" ? "Vides (±)" : "Vides"}
                    fullWidth
                    slotProps={{
                      htmlInput: {
                        inputMode: "numeric",
                        min: mode === "set" ? 0 : undefined,
                      },
                    }}
                  />
                )}
              />
            </Box>
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
