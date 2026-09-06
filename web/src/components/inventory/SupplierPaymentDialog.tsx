"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import { useGetSupplierQuery } from "@/store/api/suppliersApi";
import {
  useRecordSupplierChargeMutation,
  useRecordSupplierPaymentMutation,
} from "@/store/api/supplierLedgerApi";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "@/lib/commercial";
import type { PaymentMethod } from "@/types";

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Enregistre un versement (CREDIT, on paie le fournisseur) ou une dette de carnet (DEBIT, on note
 * ce qu'on lui doit hors bon d'achat). La direction choisit la mutation, le titre et les champs.
 *
 * <p>Seul un versement peut déclencher l'avis WhatsApp : la case n'apparaît que pour un CREDIT, et
 * seulement si l'interrupteur permanent du fournisseur (`notifyWhatsapp`) est actif. Cette case
 * voyage dans `notifySupplier` — un second garde-fou, propre à ce versement.
 */
export function SupplierPaymentDialog({
  open,
  direction,
  supplierId,
  onClose,
}: {
  open: boolean;
  direction: "DEBIT" | "CREDIT";
  supplierId: number;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      {open && (
        <SupplierPaymentBody direction={direction} supplierId={supplierId} onClose={onClose} />
      )}
    </Dialog>
  );
}

function SupplierPaymentBody({
  direction,
  supplierId,
  onClose,
}: {
  direction: "DEBIT" | "CREDIT";
  supplierId: number;
  onClose: () => void;
}) {
  const { farmId, hasFarm } = useSelectedFarm();
  const { data: supplier } = useGetSupplierQuery(
    { farmId: farmId as number, id: supplierId },
    { skip: !hasFarm },
  );
  const [recordPayment, { isLoading: paying }] = useRecordSupplierPaymentMutation();
  const [recordCharge, { isLoading: charging }] = useRecordSupplierChargeMutation();
  const { showToast } = useToast();

  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayIso());
  const [label, setLabel] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [notifySupplier, setNotifySupplier] = useState(true);

  const isCredit = direction === "CREDIT";
  const isLoading = paying || charging;
  // La relation autorise-t-elle qu'on prévienne ce fournisseur, pour ce versement précis ?
  const canNotify = isCredit && Boolean(supplier?.notifyWhatsapp);

  const value = amount ? Number(amount) : NaN;
  const canSubmit = Number.isFinite(value) && value > 0 && !isLoading && Boolean(farmId);

  const submit = async () => {
    if (!farmId || !Number.isFinite(value)) return;
    const body = {
      amountXof: value,
      entryDate,
      label: label || undefined,
      ...(isCredit
        ? {
            method,
            reference: reference || undefined,
            // Toujours explicite : omis, le serveur le lit comme vrai.
            notifySupplier: canNotify && notifySupplier,
          }
        : {}),
    };
    try {
      if (isCredit) {
        await recordPayment({ farmId, supplierId, body }).unwrap();
        showToast("Paiement enregistré.", "success");
      } else {
        await recordCharge({ farmId, supplierId, body }).unwrap();
        showToast("Dette enregistrée.", "success");
      }
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <>
      <DialogTitle component="div" sx={{ pr: 6 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {isCredit ? "Enregistrer un paiement" : "Ajouter une dette"}
        </Typography>
        {supplier && (
          <Typography variant="caption" color="text.secondary">
            {supplier.commercialName}
          </Typography>
        )}
        <IconButton onClick={onClose} aria-label="Fermer" sx={{ position: "absolute", top: 12, right: 12 }}>
          <X size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label="Montant"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            fullWidth
            inputMode="numeric"
            slotProps={{
              input: { endAdornment: <InputAdornment position="end">XOF</InputAdornment> },
            }}
          />
          <TextField
            label="Date"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Libellé"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            fullWidth
            placeholder="Précisez le motif (optionnel)"
          />

          {isCredit && (
            <>
              <TextField
                select
                label="Mode de paiement"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                fullWidth
              >
                {PAYMENT_METHOD_OPTIONS.map((m) => (
                  <MenuItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Référence"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                fullWidth
                placeholder="N° transaction… (optionnel)"
              />
            </>
          )}

          {canNotify && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={notifySupplier}
                  onChange={(e) => setNotifySupplier(e.target.checked)}
                />
              }
              label={`Prévenir ${supplier?.commercialName} par WhatsApp`}
            />
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Annuler
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={!canSubmit}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Enregistrer
        </Button>
      </DialogActions>
    </>
  );
}
