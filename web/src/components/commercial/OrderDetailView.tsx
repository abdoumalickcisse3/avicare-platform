"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Printer, X } from "lucide-react";
import {
  useCancelOrderMutation,
  useConfirmOrderMutation,
  useGetOrderQuery,
  useStartOrderPreparationMutation,
} from "@/store/api/ordersApi";
import { useGetDeliveriesQuery } from "@/store/api/deliveriesApi";
import {
  useGetInvoicesQuery,
  useCreateInvoiceFromDeliveryMutation,
} from "@/store/api/invoicesApi";
import { useGetClientQuery } from "@/store/api/clientsApi";
import { useGetCatalogQuery } from "@/store/api/catalogApi";
import { channelLabel } from "@/lib/salesChannel";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { OrderStatusStepper } from "./OrderStatusStepper";
import { DeliverOrderDialog } from "./DeliverOrderDialog";
import { DocumentFlow } from "./DocumentFlow";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { ORDER_STATUS_META, orderNextStep } from "@/lib/commercial";
import type { NextStepKind } from "@/lib/commercial";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;

export function OrderDetailView({ orderId }: { orderId: number }) {
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const { showToast } = useToast();
  const router = useRouter();
  const skip = !hasFarm || !hasCommercial;

  // ── Data fetching — all hooks must be called before early returns ─────────
  const { data: order, isLoading } = useGetOrderQuery(
    { farmId: farmId as number, id: orderId },
    { skip },
  );
  const { data: client } = useGetClientQuery(
    { farmId: farmId as number, id: order?.clientId as number },
    { skip: skip || order?.clientId == null },
  );
  const { data: deliveries } = useGetDeliveriesQuery(
    { farmId: farmId as number },
    { skip },
  );
  const { data: invoices } = useGetInvoicesQuery(
    { farmId: farmId as number },
    { skip },
  );
  const { data: channels } = useGetCatalogQuery(
    { farmId: farmId as number, category: "sales_channels" },
    { skip },
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const [confirm, { isLoading: confirming }] = useConfirmOrderMutation();
  const [startPrep, { isLoading: starting }] = useStartOrderPreparationMutation();
  const [cancel, { isLoading: cancelling }] = useCancelOrderMutation();
  const [createInvoiceFromDelivery, { isLoading: invoicing }] =
    useCreateInvoiceFromDeliveryMutation();
  const [deliverOpen, setDeliverOpen] = useState(false);

  // ── Early returns (after all hooks) ──────────────────────────────────────
  if (hasFarm && !hasCommercial) {
    return <Alert severity="info">Activez le module Commercial pour consulter cette commande.</Alert>;
  }
  if (isLoading) return <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 3 }} />;
  if (!order) return <Alert severity="error">Commande introuvable.</Alert>;

  // ── Derived state ─────────────────────────────────────────────────────────
  const meta = ORDER_STATUS_META[order.status];
  const orderChannel = channelLabel(channels, order.salesChannelKey);
  const busy = confirming || starting || cancelling || invoicing;

  /** The delivery (DELIVERED status) that belongs to this order, if any. */
  const delivery = (deliveries ?? []).find(
    (d) => d.orderId === order.id && d.status === "DELIVERED",
  );

  /** The invoice generated from this order's delivery, if any. */
  const invoice = delivery
    ? (invoices ?? []).find((i) => i.deliveryId === delivery.id)
    : undefined;

  const hasInvoice = !!invoice;
  const nextStep = orderNextStep(order, hasInvoice);

  // ── Document-flow links ───────────────────────────────────────────────────
  const flowLinks = [
    { label: order.orderNumber, current: true },
    ...(delivery
      ? [
          {
            label: delivery.deliveryNumber,
          },
        ]
      : order.status === "DELIVERED"
      ? []
      : []),
    ...(invoice
      ? [
          {
            label: invoice.invoiceNumber,
            href: `/commercial/factures/${invoice.id}`,
          },
        ]
      : []),
  ];

  // ── Helpers ───────────────────────────────────────────────────────────────
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      showToast(ok, "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const handleAction = async (kind: NextStepKind) => {
    switch (kind) {
      case "confirm":
        await run(
          () => confirm({ farmId: farmId as number, id: order.id }).unwrap(),
          "Commande confirmée.",
        );
        break;
      case "startPreparation":
        await run(
          () => startPrep({ farmId: farmId as number, id: order.id }).unwrap(),
          "Commande en préparation.",
        );
        break;
      case "deliver":
        setDeliverOpen(true);
        break;
      case "invoiceFromDelivery":
        if (!delivery) break;
        try {
          const inv = await createInvoiceFromDelivery({
            farmId: farmId as number,
            deliveryId: delivery.id,
          }).unwrap();
          showToast("Facture générée.", "success");
          router.push(`/commercial/factures/${inv.id}`);
        } catch (err) {
          showToast(apiErrorMessage(err), "error");
        }
        break;
      default:
        break;
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
          {delivery && (
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<Printer size={16} />}
              href={`/commercial/commandes/livraison/${delivery.id}/imprimer`}
              target="_blank"
              rel="noopener noreferrer"
              component="a"
            >
              Bon de livraison (PDF)
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

      {/* Document flow banner (commande → livraison? → facture?) */}
      <DocumentFlow
        links={flowLinks}
        nextStep={nextStep}
        onAction={handleAction}
        busy={busy}
      />

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
              {orderChannel && <Box>Circuit : {orderChannel}</Box>}
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

      {farmId && (
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
