"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { useUpdateStockThresholdMutation } from "@/store/api/inventoryStockApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { formatNumber } from "@/lib/format";
import type { StockItem } from "@/types";

/**
 * Règle le seuil d'alerte d'un article — l'équivalent web du `ThresholdSheet` mobile.
 *
 * La page article affichait le seuil comme un KPI sans jamais permettre de le changer : le
 * gérant au bureau voyait la valeur qui déclenche ses alertes sans pouvoir l'ajuster, et devait
 * prendre le téléphone. Même endpoint, mêmes règles.
 *
 * Le stock actuel reste sous les yeux pendant la saisie : un seuil se choisit par comparaison.
 * Un seuil au-dessus du stock est **averti, pas refusé** — c'est une façon légitime de dire
 * « je suis déjà à court », et c'est ainsi que l'alerte se lève tout de suite (cohérent D19 :
 * l'éleveur reste maître de son inventaire).
 */
export function ThresholdDialog({
  open,
  onClose,
  farmId,
  item,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  item: StockItem;
}) {
  const { showToast } = useToast();
  const [updateThreshold, { isLoading }] = useUpdateStockThresholdMutation();
  const [value, setValue] = useState("");

  // Edge-triggered on `open`: re-seeding on every render would fight the typing.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setValue(item.alertThreshold != null ? String(item.alertThreshold) : "");
    }
    wasOpen.current = open;
  }, [open, item.alertThreshold]);

  const parsed = Number(value.replace(",", "."));
  const valid = value.trim().length > 0 && Number.isFinite(parsed) && parsed >= 0;
  const alreadyBelow = valid && item.currentQuantity < parsed;

  const submit = async () => {
    if (!valid) return;
    try {
      await updateThreshold({ farmId, id: item.id, threshold: parsed }).unwrap();
      showToast("Seuil d'alerte enregistré.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>Seuil d&apos;alerte</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          {item.articleKey} · en stock {formatNumber(item.currentQuantity)}
          {item.unit ? ` ${item.unit}` : ""}
        </Typography>
        <TextField
          autoFocus
          label="Alerter en dessous de"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          fullWidth
          slotProps={{
            htmlInput: { inputMode: "decimal" },
            input: item.unit
              ? { endAdornment: <InputAdornment position="end">{item.unit}</InputAdornment> }
              : undefined,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid && !isLoading) submit();
          }}
        />
        {alreadyBelow && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Le stock est déjà sous ce seuil : l&apos;alerte se déclenchera tout de suite.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Annuler
        </Button>
        <Box>
          <Button
            variant="contained"
            onClick={submit}
            disabled={!valid || isLoading}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Enregistrer
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
