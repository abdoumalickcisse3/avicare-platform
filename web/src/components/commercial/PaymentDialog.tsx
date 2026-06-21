"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRecordPaymentMutation } from "@/store/api/paymentsApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "@/lib/commercial";
import { formatCurrency } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { Invoice, PaymentMethod } from "@/types";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;

export function PaymentDialog({
  open,
  onClose,
  farmId,
  invoice,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  invoice: Invoice;
}) {
  const { showToast } = useToast();
  const [record, { isLoading }] = useRecordPaymentMutation();
  const [amount, setAmount] = useState(String(invoice.outstandingXof));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");

  const value = Number(amount) || 0;
  const tooMuch = value > invoice.outstandingXof;
  const canSubmit = value > 0 && !tooMuch && !isLoading;

  const submit = async () => {
    try {
      await record({
        farmId,
        body: { invoiceId: invoice.id, amountXof: value, method, reference: reference || undefined },
      }).unwrap();
      showToast(`Paiement enregistré — ${formatCurrency(value)}`, "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle component="div">
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Encaisser un paiement
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {invoice.invoiceNumber} · reste dû {formatCurrency(invoice.outstandingXof)}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label="Montant"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            fullWidth
            inputMode="numeric"
            error={tooMuch}
            slotProps={{
              input: {
                endAdornment: <InputAdornment position="end">XOF</InputAdornment>,
                sx: mono,
              },
            }}
          />
          {tooMuch && <Alert severity="warning">Le montant dépasse le reste dû.</Alert>}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Mode de paiement
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }} useFlexGap>
              {PAYMENT_METHOD_OPTIONS.map((m) => (
                <Button
                  key={m}
                  size="small"
                  variant={method === m ? "contained" : "outlined"}
                  color={method === m ? "primary" : "inherit"}
                  onClick={() => setMethod(m)}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </Button>
              ))}
            </Stack>
          </Box>
          <TextField
            label="Référence"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            fullWidth
            placeholder="N° transaction Wave / chèque… (optionnel)"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Annuler
        </Button>
        <Button onClick={submit} variant="contained" disabled={!canSubmit} sx={{ color: colors.neutral[0] }}>
          Encaisser
        </Button>
      </DialogActions>
    </Dialog>
  );
}
