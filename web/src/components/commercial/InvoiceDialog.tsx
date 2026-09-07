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

  /**
   * Le numéro de la facture VIVANTE d'une source, s'il y en a une.
   *
   * Le commentaire disait « not yet invoiced and not cancelled », mais le filtre ne regardait pas
   * le statut : une facture annulée retenait sa source pour toujours. Depuis V56 une annulation
   * libère la vente, et seules les factures vivantes comptent.
   *
   * La source déjà facturée n'est plus retirée de la liste non plus : elle y reste, désactivée,
   * avec son numéro. Elle disparaissait sans un mot — on ouvrait « Nouvelle facture », on ne
   * trouvait pas sa vente, et rien ne disait pourquoi.
   */
  const liveInvoiceOf = useMemo(() => {
    const bySale = new Map<number, string>();
    const byDelivery = new Map<number, string>();
    for (const i of invoices ?? []) {
      if (i.status === "CANCELLED") continue;
      if (i.saleId != null) bySale.set(i.saleId, i.invoiceNumber);
      if (i.deliveryId != null) byDelivery.set(i.deliveryId, i.invoiceNumber);
    }
    return { bySale, byDelivery };
  }, [invoices]);

  const options = useMemo(
    () =>
      source === "SALE"
        ? (sales ?? [])
            .filter((s) => s.status === "COMPLETED")
            .map((s) => ({
              id: s.id,
              label: s.saleNumber,
              date: s.saleDate,
              totalXof: s.totalXof,
              invoicedAs: liveInvoiceOf.bySale.get(s.id) ?? null,
            }))
        : (deliveries ?? [])
            .filter((d) => d.status === "DELIVERED")
            .map((d) => ({
              id: d.id,
              label: d.deliveryNumber,
              date: d.deliveryDate,
              totalXof: d.totalXof,
              invoicedAs: liveInvoiceOf.byDelivery.get(d.id) ?? null,
            })),
    [source, sales, deliveries, liveInvoiceOf],
  );
  const billable = options.filter((o) => o.invoicedAs === null);

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
              <MenuItem key={o.id} value={String(o.id)} disabled={o.invoicedAs !== null}>
                {o.label} · {formatDate(o.date)} · {formatCurrency(o.totalXof)}
                {o.invoicedAs !== null ? ` — déjà facturée (${o.invoicedAs})` : ""}
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

          {/* Deux vides différents : rien à facturer, ou tout est déjà facturé. Dire lequel. */}
          {billable.length === 0 && (
            <Alert severity="info">
              {options.length === 0
                ? `Aucune ${source === "SALE" ? "vente terminée" : "livraison effectuée"} pour le moment.`
                : `Toutes les ${source === "SALE" ? "ventes" : "livraisons"} sont déjà facturées.`}
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
