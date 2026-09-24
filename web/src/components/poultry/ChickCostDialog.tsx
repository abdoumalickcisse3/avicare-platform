"use client";

import { useEffect, useState } from "react";
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
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import { useSetChickCostMutation } from "@/store/api/poultryBatchesApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";

/**
 * Renseigner ou corriger le prix par poussin d'une bande — action dédiée, jamais un formulaire
 * d'édition générique de la bande. Le prix unitaire déjà enregistré (dérivé du montant total et de
 * l'effectif initial) est pré-rempli pour permettre une correction.
 */
export function ChickCostDialog({
  open,
  onClose,
  farmId,
  batchId,
  initialCount,
  currentValueXof,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  batchId: number;
  initialCount: number;
  currentValueXof: number | null;
}) {
  const { showToast } = useToast();
  const [setChickCost, { isLoading }] = useSetChickCostMutation();
  const [unitPrice, setUnitPrice] = useState("");

  useEffect(() => {
    if (open) {
      setUnitPrice(
        currentValueXof != null && initialCount > 0
          ? String(Math.round(currentValueXof / initialCount))
          : "",
      );
    }
  }, [open, currentValueXof, initialCount]);

  const valid = /^\d+$/.test(unitPrice) && Number(unitPrice) > 0;
  const total = valid ? Number(unitPrice) * initialCount : null;

  const submit = async () => {
    if (!valid) return;
    try {
      await setChickCost({
        farmId,
        batchId,
        body: { chickUnitPriceXof: Number(unitPrice) },
      }).unwrap();
      showToast("Coût des poussins enregistré.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle component="div" sx={{ pr: 6 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {currentValueXof != null ? "Modifier le coût des poussins" : "Renseigner le coût des poussins"}
        </Typography>
        <IconButton
          onClick={onClose}
          aria-label="Fermer"
          sx={{ position: "absolute", top: 12, right: 12 }}
        >
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Prix par poussin (FCFA)"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value.replace(/[^0-9]/g, ""))}
            fullWidth
            autoFocus
            slotProps={{ htmlInput: { inputMode: "numeric" } }}
            helperText={total != null ? `Total : ${total.toLocaleString("fr-FR")} FCFA` : undefined}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Annuler
        </Button>
        <Button
          onClick={submit}
          variant="contained"
          color="primary"
          disabled={!valid || isLoading}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Enregistrer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
