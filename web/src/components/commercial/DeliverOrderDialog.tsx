"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCreateDeliveryFromOrderMutation } from "@/store/api/deliveriesApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";

/**
 * Convert an in-progress order into a delivery (Sprint B5-6c): pick the carrier
 * and delivery date; the backend snapshots the lines, decrements stock (D21) and
 * marks the order DELIVERED.
 */
export function DeliverOrderDialog({
  open,
  onClose,
  farmId,
  orderId,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  orderId: number;
}) {
  const { showToast } = useToast();
  const [deliver, { isLoading }] = useCreateDeliveryFromOrderMutation();
  const [carrier, setCarrier] = useState("");
  const [date, setDate] = useState("");

  const submit = async () => {
    try {
      await deliver({
        farmId,
        body: { orderId, carrier: carrier || undefined, deliveryDate: date || undefined },
      }).unwrap();
      showToast("Livraison enregistrée — stock décrémenté.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle component="div">
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Livrer la commande
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label="Transporteur"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            fullWidth
            placeholder="Optionnel"
          />
          <TextField
            label="Date de livraison"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Aujourd'hui par défaut"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Annuler
        </Button>
        <Button onClick={submit} variant="contained" disabled={isLoading}>
          Confirmer la livraison
        </Button>
      </DialogActions>
    </Dialog>
  );
}
