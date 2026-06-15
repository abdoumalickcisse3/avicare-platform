"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  useCancelPurchaseOrderMutation,
  useGetPurchaseOrderQuery,
  useReceivePurchaseOrderMutation,
  useSubmitPurchaseOrderMutation,
} from "@/store/api/purchaseOrdersApi";
import { useInventoryGating } from "@/hooks/useInventoryGating";
import { PurchaseOrderWorkflowActions } from "./PurchaseOrderWorkflowActions";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency, formatDate } from "@/lib/format";
import { PO_STATUS_META } from "@/lib/inventory";
import { colors } from "@/theme/tokens";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;

export function PurchaseOrderDetailView({ poId }: { poId: number }) {
  const { showToast } = useToast();
  const { farmId, hasFarm, hasInventory } = useInventoryGating();
  const skip = !hasFarm || !hasInventory;
  const { data: po, isLoading } = useGetPurchaseOrderQuery(
    { farmId: farmId as number, id: poId },
    { skip },
  );

  const [submit, { isLoading: submitting }] = useSubmitPurchaseOrderMutation();
  const [receive, { isLoading: receiving }] = useReceivePurchaseOrderMutation();
  const [cancel, { isLoading: cancelling }] = useCancelPurchaseOrderMutation();
  const busy = submitting || receiving || cancelling;

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [received, setReceived] = useState<Record<number, string>>({});

  const openReceive = () => {
    if (po) {
      setReceived(Object.fromEntries(po.items.map((l) => [l.id, String(l.orderedQuantity)])));
    }
    setReceiveOpen(true);
  };

  const meta = po ? PO_STATUS_META[po.status] : null;

  const doSubmit = async () => {
    try {
      await submit({ farmId: farmId as number, id: poId }).unwrap();
      showToast("Bon envoyé au fournisseur.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };
  const doCancel = async () => {
    try {
      await cancel({ farmId: farmId as number, id: poId }).unwrap();
      showToast("Bon annulé.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };
  const doReceive = async () => {
    if (!po) return;
    try {
      await receive({
        farmId: farmId as number,
        id: poId,
        body: {
          lines: po.items.map((l) => ({
            itemId: l.id,
            receivedQuantity: Number((received[l.id] ?? "0").replace(",", ".")) || 0,
          })),
        },
      }).unwrap();
      showToast("Réception enregistrée — stock mis à jour.", "success");
      setReceiveOpen(false);
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  if (isLoading) return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 3 }} />;
  if (!po) return <Alert severity="error">Bon d&apos;achat introuvable.</Alert>;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link href="/stocks/achats" style={{ color: colors.neutral[500], textDecoration: "none" }}>
          Bons d&apos;achat
        </Link>
        <Typography color="text.primary">{po.orderNumber}</Typography>
      </Breadcrumbs>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Typography variant="h4" sx={{ ...mono, fontWeight: 700 }}>
            {po.orderNumber}
          </Typography>
          {meta && (
            <Chip label={meta.label} sx={{ bgcolor: meta.bg, color: meta.fg, fontWeight: 600 }} />
          )}
        </Stack>
        <PurchaseOrderWorkflowActions
          status={po.status}
          onSubmit={doSubmit}
          onReceive={openReceive}
          onCancel={doCancel}
          busy={busy}
        />
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
          mb: 3,
        }}
      >
        <Meta label="Fournisseur" value={po.supplierName} />
        <Meta label="Date commande" value={formatDate(po.orderDate)} />
        <Meta
          label="Livraison prévue"
          value={po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : "—"}
        />
        <Meta
          label="Livraison réelle"
          value={po.actualDeliveryDate ? formatDate(po.actualDeliveryDate) : "—"}
        />
      </Box>

      <TableContainer sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Article</TableCell>
              <TableCell align="right">Commandé</TableCell>
              <TableCell align="right">Reçu</TableCell>
              <TableCell align="right">Prix unit.</TableCell>
              <TableCell align="right">Total ligne</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {po.items.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.articleLabelSnapshot ?? l.articleKey}</TableCell>
                <TableCell align="right" sx={mono}>
                  {l.orderedQuantity} {l.unit ?? ""}
                </TableCell>
                <TableCell align="right" sx={mono}>
                  {l.receivedQuantity} {l.unit ?? ""}
                </TableCell>
                <TableCell align="right" sx={mono}>
                  {formatCurrency(l.unitPriceXof)}
                </TableCell>
                <TableCell align="right" sx={mono}>
                  {formatCurrency(l.lineTotalXof)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" sx={{ justifyContent: "flex-end", mt: 2 }}>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="caption" color="text.secondary">
            Total
          </Typography>
          <Typography variant="h5" sx={{ ...mono, fontWeight: 700 }}>
            {po.totalXof != null ? formatCurrency(po.totalXof) : "—"}
          </Typography>
        </Box>
      </Stack>

      <Dialog open={receiveOpen} onClose={() => setReceiveOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Réceptionner le bon {po.orderNumber}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Confirmez les quantités réellement reçues. Le stock sera alimenté en conséquence.
            </Typography>
            {po.items.map((l) => (
              <Stack key={l.id} direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Box sx={{ flex: 1 }}>{l.articleLabelSnapshot ?? l.articleKey}</Box>
                <TextField
                  label="Reçu"
                  value={received[l.id] ?? ""}
                  onChange={(e) => setReceived((r) => ({ ...r, [l.id]: e.target.value }))}
                  type="number"
                  size="small"
                  sx={{ width: 140 }}
                  slotProps={{ htmlInput: { inputMode: "decimal", min: 0 } }}
                />
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setReceiveOpen(false)} color="inherit">
            Annuler
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={doReceive}
            disabled={receiving}
            startIcon={receiving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Confirmer la réception
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: colors.neutral[50],
        border: `1px solid ${colors.neutral[200]}`,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}
