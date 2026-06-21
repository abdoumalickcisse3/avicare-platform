"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  useCreateInvoiceFromDeliveryMutation,
  useCreateInvoiceFromSaleMutation,
  useGetInvoicesQuery,
} from "@/store/api/invoicesApi";
import { useGetSalesQuery } from "@/store/api/salesApi";
import { useGetDeliveriesQuery } from "@/store/api/deliveriesApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency, formatDate } from "@/lib/format";
import type { InvoiceSourceType } from "@/types";

export function InvoiceDialog({
  open,
  onClose,
  farmId,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && <InvoiceBody onClose={onClose} farmId={farmId} />}
    </Dialog>
  );
}

function InvoiceBody({ onClose, farmId }: { onClose: () => void; farmId: number }) {
  const { showToast } = useToast();
  const { data: invoices } = useGetInvoicesQuery({ farmId });
  const { data: sales } = useGetSalesQuery({ farmId });
  const { data: deliveries } = useGetDeliveriesQuery({ farmId });
  const [fromSale, { isLoading: s1 }] = useCreateInvoiceFromSaleMutation();
  const [fromDelivery, { isLoading: s2 }] = useCreateInvoiceFromDeliveryMutation();

  const [source, setSource] = useState<InvoiceSourceType>("SALE");
  const [sourceId, setSourceId] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Sources not yet invoiced and not cancelled.
  const invoicedSaleIds = useMemo(
    () => new Set((invoices ?? []).filter((i) => i.saleId != null).map((i) => i.saleId)),
    [invoices],
  );
  const invoicedDeliveryIds = useMemo(
    () => new Set((invoices ?? []).filter((i) => i.deliveryId != null).map((i) => i.deliveryId)),
    [invoices],
  );
  const eligibleSales = useMemo(
    () => (sales ?? []).filter((s) => s.status === "COMPLETED" && !invoicedSaleIds.has(s.id)),
    [sales, invoicedSaleIds],
  );
  const eligibleDeliveries = useMemo(
    () => (deliveries ?? []).filter((d) => d.status === "DELIVERED" && !invoicedDeliveryIds.has(d.id)),
    [deliveries, invoicedDeliveryIds],
  );

  const options = source === "SALE" ? eligibleSales : eligibleDeliveries;

  const submit = async () => {
    const id = Number(sourceId);
    try {
      if (source === "SALE") {
        await fromSale({ farmId, saleId: id, dueDate: dueDate || undefined }).unwrap();
      } else {
        await fromDelivery({ farmId, deliveryId: id, dueDate: dueDate || undefined }).unwrap();
      }
      showToast("Facture générée.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <>
      <DialogTitle component="div">
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Nouvelle facture
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <ToggleButtonGroup
            value={source}
            exclusive
            onChange={(_e, v) => {
              if (v) {
                setSource(v);
                setSourceId("");
              }
            }}
            fullWidth
            size="small"
          >
            <ToggleButton value="SALE">Depuis une vente</ToggleButton>
            <ToggleButton value="DELIVERY">Depuis une livraison</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            select
            label={source === "SALE" ? "Vente" : "Livraison"}
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            fullWidth
          >
            {options.length === 0 && (
              <MenuItem value="" disabled>
                Aucune {source === "SALE" ? "vente" : "livraison"} à facturer
              </MenuItem>
            )}
            {options.map((o) => (
              <MenuItem key={o.id} value={String(o.id)}>
                {"saleNumber" in o ? o.saleNumber : o.deliveryNumber} · {formatDate(
                  "saleDate" in o ? o.saleDate : o.deliveryDate,
                )}{" "}
                · {formatCurrency(o.totalXof)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Échéance"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Optionnel — au-delà, la facture sera marquée en retard"
          />

          {options.length === 0 && (
            <Alert severity="info">
              Toutes les {source === "SALE" ? "ventes" : "livraisons"} sont déjà facturées.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Annuler
        </Button>
        <Button onClick={submit} variant="contained" disabled={sourceId === "" || s1 || s2}>
          Générer la facture
        </Button>
      </DialogActions>
    </>
  );
}
