"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Check, PackageCheck, Play, X } from "lucide-react";
import {
  useCancelOrderMutation,
  useConfirmOrderMutation,
  useGetOrderQuery,
  useStartOrderPreparationMutation,
} from "@/store/api/ordersApi";
import { useGetClientQuery } from "@/store/api/clientsApi";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { OrderStatusStepper } from "./OrderStatusStepper";
import { DeliverOrderDialog } from "./DeliverOrderDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { ORDER_STATUS_META } from "@/lib/commercial";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;

export function OrderDetailView({ orderId }: { orderId: number }) {
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const { showToast } = useToast();
  const skip = !hasFarm || !hasCommercial;
  const { data: order, isLoading } = useGetOrderQuery(
    { farmId: farmId as number, id: orderId },
    { skip },
  );
  const { data: client } = useGetClientQuery(
    { farmId: farmId as number, id: order?.clientId as number },
    { skip: skip || order?.clientId == null },
  );
  const [confirm, { isLoading: confirming }] = useConfirmOrderMutation();
  const [startPrep, { isLoading: starting }] = useStartOrderPreparationMutation();
  const [cancel, { isLoading: cancelling }] = useCancelOrderMutation();
  const [deliverOpen, setDeliverOpen] = useState(false);

  if (hasFarm && !hasCommercial) {
    return <Alert severity="info">Activez le module Commercial pour consulter cette commande.</Alert>;
  }
  if (isLoading) return <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 3 }} />;
  if (!order) return <Alert severity="error">Commande introuvable.</Alert>;

  const meta = ORDER_STATUS_META[order.status];
  const busy = confirming || starting || cancelling;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      showToast(ok, "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link href="/commercial/commandes" style={{ color: colors.neutral[500], textDecoration: "none" }}>
          Commandes
        </Link>
        <Typography color="text.primary">{order.orderNumber}</Typography>
      </Breadcrumbs>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { md: "center" }, mb: 3 }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {order.orderNumber}
          </Typography>
          <Chip
            label={meta.label}
            size="small"
            sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 600 }}
          />
        </Stack>
        <Stack direction="row" spacing={1}>
          {order.status === "PENDING" && (
            <Button
              variant="contained"
              startIcon={<Check size={16} />}
              disabled={busy}
              onClick={() => run(() => confirm({ farmId: farmId as number, id: order.id }).unwrap(), "Commande confirmée.")}
            >
              Confirmer
            </Button>
          )}
          {order.status === "CONFIRMED" && (
            <Button
              variant="contained"
              startIcon={<Play size={16} />}
              disabled={busy}
              onClick={() => run(() => startPrep({ farmId: farmId as number, id: order.id }).unwrap(), "Commande en préparation.")}
            >
              Préparer
            </Button>
          )}
          {order.status === "IN_PROGRESS" && (
            <Button variant="contained" startIcon={<PackageCheck size={16} />} onClick={() => setDeliverOpen(true)}>
              Livrer la commande
            </Button>
          )}
          {order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<X size={16} />}
              disabled={busy}
              onClick={() => run(() => cancel({ farmId: farmId as number, id: order.id }).unwrap(), "Commande annulée.")}
            >
              Annuler
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Stepper — the per-order signature */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <OrderStatusStepper status={order.status} />
        </CardContent>
      </Card>

      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr", md: "1fr 2fr" },
        }}
      >
        {/* Client + dates */}
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Client
            </Typography>
            <Typography sx={{ fontWeight: 700, mt: 0.5 }}>
              {client?.displayName ?? (order.clientId ? `Client #${order.clientId}` : "—")}
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <Stack spacing={0.5} sx={{ color: colors.neutral[700], fontSize: 14 }}>
              <Box>Commande : {formatDate(order.orderDate)}</Box>
              <Box>
                Livraison prévue :{" "}
                {order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : "—"}
              </Box>
              {order.actualDeliveryDate && <Box>Livrée le : {formatDate(order.actualDeliveryDate)}</Box>}
              {order.deliveryAddress && <Box>Adresse : {order.deliveryAddress}</Box>}
            </Stack>
          </CardContent>
        </Card>

        {/* Lines */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Lignes de commande
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Produit</TableCell>
                    <TableCell align="right">Qté</TableCell>
                    <TableCell align="right">PU</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {order.items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.articleLabelSnapshot ?? it.articleKey}</TableCell>
                      <TableCell align="right" sx={mono}>
                        {formatNumber(it.quantity)} {it.unit}
                      </TableCell>
                      <TableCell align="right" sx={mono}>
                        {formatCurrency(it.unitPriceXof)}
                      </TableCell>
                      <TableCell align="right" sx={{ ...mono, fontWeight: 600 }}>
                        {formatCurrency(it.lineTotalXof)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} align="right" sx={{ fontWeight: 700, border: 0 }}>
                      Total (HT)
                    </TableCell>
                    <TableCell align="right" sx={{ ...mono, fontWeight: 700, border: 0, color: colors.primary[600] }}>
                      {formatCurrency(order.totalXof)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>

      {farmId && order.status === "IN_PROGRESS" && (
        <DeliverOrderDialog
          open={deliverOpen}
          onClose={() => setDeliverOpen(false)}
          farmId={farmId}
          orderId={order.id}
        />
      )}
    </Box>
  );
}
