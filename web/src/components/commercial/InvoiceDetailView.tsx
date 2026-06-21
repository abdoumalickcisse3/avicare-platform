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
import { Ban, Printer } from "lucide-react";
import { useCancelInvoiceMutation, useGetInvoiceQuery } from "@/store/api/invoicesApi";
import { useGetPaymentsQuery, useVoidPaymentMutation } from "@/store/api/paymentsApi";
import { useGetClientQuery } from "@/store/api/clientsApi";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { DocumentFlow } from "./DocumentFlow";
import { PaymentDialog } from "./PaymentDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import {
  INVOICE_STATUS_META,
  PAYMENT_METHOD_LABELS,
  invoiceNextStep,
  isInvoiceOverdue,
} from "@/lib/commercial";
import type { NextStepKind } from "@/lib/commercial";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;

export function InvoiceDetailView({ invoiceId }: { invoiceId: number }) {
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const { showToast } = useToast();
  const skip = !hasFarm || !hasCommercial;

  // ── Data fetching — all hooks before early returns ────────────────────────
  const { data: invoice, isLoading } = useGetInvoiceQuery(
    { farmId: farmId as number, id: invoiceId },
    { skip },
  );
  const { data: payments } = useGetPaymentsQuery(
    { farmId: farmId as number, invoiceId },
    { skip },
  );
  const { data: client } = useGetClientQuery(
    { farmId: farmId as number, id: invoice?.clientId as number },
    { skip: skip || invoice?.clientId == null },
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const [cancel, { isLoading: cancelling }] = useCancelInvoiceMutation();
  const [voidPayment] = useVoidPaymentMutation();
  const [payOpen, setPayOpen] = useState(false);

  // ── Early returns (after all hooks) ──────────────────────────────────────
  if (hasFarm && !hasCommercial) {
    return <Alert severity="info">Activez le module Commercial pour consulter cette facture.</Alert>;
  }
  if (isLoading) return <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 3 }} />;
  if (!invoice) return <Alert severity="error">Facture introuvable.</Alert>;

  // ── Derived state ─────────────────────────────────────────────────────────
  const meta = INVOICE_STATUS_META[invoice.status];
  const overdue = isInvoiceOverdue(invoice);
  const canCancel = invoice.status !== "CANCELLED" && invoice.status !== "PAID";
  const nextStep = invoiceNextStep(invoice);

  // ── Document-flow links ───────────────────────────────────────────────────
  const flowLinks = [
    ...(invoice.sourceType === "DELIVERY" && invoice.deliveryId
      ? [
          {
            label: `Livraison #${invoice.deliveryId}`,
            href: `/commercial/livraisons/${invoice.deliveryId}`,
          },
        ]
      : invoice.sourceType === "SALE" && invoice.saleId
      ? [
          {
            label: `Vente #${invoice.saleId}`,
            href: `/commercial/ventes/${invoice.saleId}`,
          },
        ]
      : []),
    { label: invoice.invoiceNumber, current: true },
    ...((payments ?? []).filter((p) => p.status !== "CANCELLED").length > 0
      ? [{ label: `${(payments ?? []).filter((p) => p.status !== "CANCELLED").length} paiement(s)` }]
      : []),
  ];

  // ── Handlers ──────────────────────────────────────────────────────────────
  const onCancel = async () => {
    try {
      await cancel({ farmId: farmId as number, id: invoice.id }).unwrap();
      showToast("Facture annulée.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };
  const onVoid = async (paymentId: number) => {
    try {
      await voidPayment({ farmId: farmId as number, id: paymentId }).unwrap();
      showToast("Paiement annulé.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const handleAction = (kind: NextStepKind) => {
    if (kind === "recordPayment") {
      setPayOpen(true);
    }
  };

  const amount = (label: string, value: number, color?: string) => (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography sx={{ ...mono, fontWeight: 700, fontSize: 20, color }}>
        {formatCurrency(value)}
      </Typography>
    </Box>
  );

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link href="/commercial/factures" style={{ color: colors.neutral[500], textDecoration: "none" }}>
          Factures
        </Link>
        <Typography color="text.primary">{invoice.invoiceNumber}</Typography>
      </Breadcrumbs>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { md: "center" }, mb: 3 }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {invoice.invoiceNumber}
          </Typography>
          <Chip label={meta.label} size="small" sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 600 }} />
          {overdue && (
            <Chip label="En retard" size="small" sx={{ bgcolor: colors.error.light, color: colors.error.dark, fontWeight: 600 }} />
          )}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<Printer size={16} />}
            href={`/commercial/factures/${invoice.id}/imprimer`}
            target="_blank"
            rel="noopener noreferrer"
            component="a"
          >
            Imprimer / PDF
          </Button>
          {canCancel && (
            <Button variant="outlined" color="inherit" startIcon={<Ban size={16} />} disabled={cancelling} onClick={onCancel}>
              Annuler
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Document flow banner (source → facture [current] → paiement(s)) */}
      <DocumentFlow
        links={flowLinks}
        nextStep={nextStep}
        onAction={handleAction}
        busy={cancelling}
      />

      {/* Amounts */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={4}>
            {amount("Total (HT)", invoice.totalXof)}
            {amount("Payé", invoice.amountPaidXof, colors.success.main)}
            {amount("Reste dû", invoice.outstandingXof, invoice.outstandingXof > 0 ? colors.error.main : colors.success.main)}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Client / Échéance
              </Typography>
              <Typography sx={{ fontWeight: 600 }}>
                {client?.displayName ?? (invoice.clientId ? `Client #${invoice.clientId}` : "Comptant")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {invoice.dueDate ? `Échéance ${formatDate(invoice.dueDate)}` : "Sans échéance"}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr", md: "3fr 2fr" },
        }}
      >
        {/* Lines */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Lignes
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
                  {invoice.items.map((it) => (
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
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Paiements
            </Typography>
            {(payments ?? []).length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Aucun paiement enregistré.
              </Typography>
            )}
            <Stack spacing={1}>
              {(payments ?? []).map((p) => {
                const cancelled = p.status === "CANCELLED";
                return (
                  <Stack
                    key={p.id}
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", opacity: cancelled ? 0.5 : 1 }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 600, textDecoration: cancelled ? "line-through" : "none" }}>
                        {formatCurrency(p.amountXof)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {p.paymentNumber} · {PAYMENT_METHOD_LABELS[p.method]} · {formatDate(p.paymentDate)}
                      </Typography>
                    </Box>
                    {!cancelled ? (
                      <Button size="small" color="inherit" onClick={() => onVoid(p.id)}>
                        Annuler
                      </Button>
                    ) : (
                      <Chip label="Annulé" size="small" sx={{ bgcolor: colors.neutral[200] }} />
                    )}
                  </Stack>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {farmId && (
        <PaymentDialog open={payOpen} onClose={() => setPayOpen(false)} farmId={farmId} invoice={invoice} />
      )}
    </Box>
  );
}
