"use client";

import { useEffect, useRef } from "react";
import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useGetInvoiceQuery } from "@/store/api/invoicesApi";
import { useGetClientQuery } from "@/store/api/clientsApi";
import { useGetMyFarmsQuery } from "@/store/api/farmsApi";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { formatCurrency, formatDate } from "@/lib/format";
import { INVOICE_STATUS_META } from "@/lib/commercial";
import { colors } from "@/theme/tokens";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;

interface Props {
  invoiceId: number;
}

/**
 * A4 printable invoice — no app chrome, triggers window.print() once data is loaded.
 * Wrapped in a route page that awaits params so the id is available server-side.
 */
export function PrintableInvoice({ invoiceId }: Props) {
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const skip = !hasFarm || !hasCommercial;

  // ── Data fetching — all hooks before early returns ────────────────────────
  const { data: invoice, isSuccess: invoiceLoaded } = useGetInvoiceQuery(
    { farmId: farmId as number, id: invoiceId },
    { skip },
  );
  const { data: client } = useGetClientQuery(
    { farmId: farmId as number, id: invoice?.clientId as number },
    { skip: skip || invoice?.clientId == null },
  );
  const { data: farms } = useGetMyFarmsQuery();

  // ── Auto-print once: fire window.print() exactly once after data loads ────
  const printed = useRef(false);
  useEffect(() => {
    if (invoiceLoaded && invoice && !printed.current) {
      printed.current = true;
      window.print();
    }
  }, [invoiceLoaded, invoice]);

  // ── Early returns (after all hooks) ──────────────────────────────────────
  if (!invoice) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="text.secondary">Chargement…</Typography>
      </Box>
    );
  }

  const farmName = farms?.find((f) => f.id === farmId)?.name ?? "—";
  const meta = INVOICE_STATUS_META[invoice.status];

  return (
    <Box
      data-print-root
      sx={{
        maxWidth: 794, // A4 at 96dpi
        mx: "auto",
        p: { xs: 3 },
        bgcolor: colors.neutral[0],
        fontFamily: "var(--font-sans)",
        "@media print": {
          maxWidth: "100%",
          p: 0,
        },
      }}
    >
      {/* Header: farm name */}
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 4 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: colors.primary[600] }}>
            {farmName}
          </Typography>
          <Typography variant="caption" sx={{ color: colors.neutral[500] }}>
            Facture
          </Typography>
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {invoice.invoiceNumber}
          </Typography>
          <Box
            sx={{
              display: "inline-block",
              px: 1.5,
              py: 0.25,
              borderRadius: 1,
              bgcolor: meta.bg,
              color: meta.color,
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            {meta.label}
          </Box>
        </Box>
      </Stack>

      <Divider sx={{ mb: 3 }} />

      {/* Client block + dates */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={4} sx={{ mb: 4 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: colors.neutral[500], textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Facturé à
          </Typography>
          <Typography sx={{ fontWeight: 600, mt: 0.5 }}>
            {client?.displayName ?? (invoice.clientId ? `Client #${invoice.clientId}` : "Comptant")}
          </Typography>
          {client?.address && (
            <Typography variant="body2" color="text.secondary">
              {client.address}
              {client.city ? `, ${client.city}` : ""}
            </Typography>
          )}
          {client?.phone && (
            <Typography variant="body2" color="text.secondary">
              {client.phone}
            </Typography>
          )}
        </Box>
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: colors.neutral[500], textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Dates
          </Typography>
          <Stack spacing={0.25} sx={{ mt: 0.5 }}>
            <Typography variant="body2">
              <strong>Émission :</strong> {formatDate(invoice.issueDate)}
            </Typography>
            {invoice.dueDate && (
              <Typography variant="body2">
                <strong>Échéance :</strong> {formatDate(invoice.dueDate)}
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>

      {/* Line items table */}
      <Table size="small" sx={{ mb: 3, "& th": { fontWeight: 700, bgcolor: colors.neutral[100] } }}>
        <TableHead>
          <TableRow>
            <TableCell>Produit</TableCell>
            <TableCell align="right">Qté</TableCell>
            <TableCell align="right">PU (HT)</TableCell>
            <TableCell align="right">Total (HT)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoice.items.map((it) => (
            <TableRow key={it.id}>
              <TableCell>{it.articleLabelSnapshot ?? it.articleKey}</TableCell>
              <TableCell align="right" sx={mono}>
                {it.quantity} {it.unit}
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

      {/* Totals */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 4 }}>
        <Stack spacing={0.75} sx={{ minWidth: 240 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">
              Total (HT)
            </Typography>
            <Typography variant="body2" sx={mono}>
              {formatCurrency(invoice.totalXof)}
            </Typography>
          </Stack>
          <Stack direction="row" sx={{ justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">
              Payé
            </Typography>
            <Typography variant="body2" sx={{ ...mono, color: colors.success.main }}>
              {formatCurrency(invoice.amountPaidXof)}
            </Typography>
          </Stack>
          <Divider />
          <Stack direction="row" sx={{ justifyContent: "space-between" }}>
            <Typography sx={{ fontWeight: 700 }}>Reste dû</Typography>
            <Typography
              sx={{
                ...mono,
                fontWeight: 700,
                color:
                  invoice.outstandingXof > 0 ? colors.error.main : colors.success.main,
              }}
            >
              {formatCurrency(invoice.outstandingXof)}
            </Typography>
          </Stack>
        </Stack>
      </Box>

      {/* Notes */}
      {invoice.notes && (
        <Box sx={{ borderTop: `1px solid ${colors.neutral[200]}`, pt: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: colors.neutral[500] }}>
            Notes
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {invoice.notes}
          </Typography>
        </Box>
      )}

      <Divider sx={{ mt: 4, mb: 2 }} />
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center" }}>
        {farmName} — Document généré le {formatDate(new Date().toISOString())}
      </Typography>
    </Box>
  );
}
