"use client";

import { useEffect, useRef } from "react";
import { Box, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useGetDeliveryQuery } from "@/store/api/deliveriesApi";
import { useGetClientQuery } from "@/store/api/clientsApi";
import { useGetMyFarmsQuery } from "@/store/api/farmsApi";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";

interface Props {
  deliveryId: number;
}

/**
 * A4 printable delivery note — no amounts by default, no app chrome.
 * Triggers window.print() once data is loaded. Opened in a new tab from
 * OrderDetailView or the livraisons tab row.
 */
export function PrintableDeliveryNote({ deliveryId }: Props) {
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const skip = !hasFarm || !hasCommercial;

  // ── Data fetching — all hooks before early returns ────────────────────────
  const { data: delivery, isSuccess: deliveryLoaded } = useGetDeliveryQuery(
    { farmId: farmId as number, id: deliveryId },
    { skip },
  );
  const { data: client } = useGetClientQuery(
    { farmId: farmId as number, id: delivery?.clientId as number },
    { skip: skip || delivery?.clientId == null },
  );
  const { data: farms } = useGetMyFarmsQuery();

  // ── Auto-print once: fire window.print() exactly once after data loads ────
  const printed = useRef(false);
  useEffect(() => {
    if (deliveryLoaded && delivery && !printed.current) {
      printed.current = true;
      window.print();
    }
  }, [deliveryLoaded, delivery]);

  // ── Early returns (after all hooks) ──────────────────────────────────────
  if (!delivery) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="text.secondary">Chargement…</Typography>
      </Box>
    );
  }

  const farmName = farms?.find((f) => f.id === farmId)?.name ?? "—";

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
      {/* Header */}
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 4 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: colors.primary[600] }}>
            {farmName}
          </Typography>
          <Typography variant="caption" sx={{ color: colors.neutral[500] }}>
            Bon de livraison
          </Typography>
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {delivery.deliveryNumber}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatDate(delivery.deliveryDate)}
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ mb: 3 }} />

      {/* Client block + carrier */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={4} sx={{ mb: 4 }}>
        <Box sx={{ flex: 1 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: colors.neutral[500],
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Livré à
          </Typography>
          <Typography sx={{ fontWeight: 600, mt: 0.5 }}>
            {client?.displayName ?? (delivery.clientId ? `Client #${delivery.clientId}` : "Comptant")}
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
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: colors.neutral[500],
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Informations
          </Typography>
          <Stack spacing={0.25} sx={{ mt: 0.5 }}>
            <Typography variant="body2">
              <strong>Date de livraison :</strong> {formatDate(delivery.deliveryDate)}
            </Typography>
            {delivery.carrier && (
              <Typography variant="body2">
                <strong>Transporteur :</strong> {delivery.carrier}
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>

      {/* Delivered items — quantities and articles, no amounts */}
      <Table
        size="small"
        sx={{ mb: 4, "& th": { fontWeight: 700, bgcolor: colors.neutral[100] } }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Article</TableCell>
            <TableCell align="right">Qté livrée</TableCell>
            <TableCell>Unité</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {delivery.items.map((it) => (
            <TableRow key={it.id}>
              <TableCell>{it.articleLabelSnapshot ?? it.articleKey}</TableCell>
              <TableCell
                align="right"
                sx={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
              >
                {it.quantity}
              </TableCell>
              <TableCell>{it.unit}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Notes */}
      {delivery.notes && (
        <Box sx={{ borderTop: `1px solid ${colors.neutral[200]}`, pt: 2, mb: 3 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: colors.neutral[500] }}>
            Notes
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {delivery.notes}
          </Typography>
        </Box>
      )}

      {/* Signature area */}
      <Stack direction="row" spacing={6} sx={{ mt: 4, mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Signature du livreur
          </Typography>
          <Box
            sx={{
              mt: 1,
              height: 48,
              borderBottom: `1px solid ${colors.neutral[300]}`,
            }}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Signature du destinataire
          </Typography>
          <Box
            sx={{
              mt: 1,
              height: 48,
              borderBottom: `1px solid ${colors.neutral[300]}`,
            }}
          />
        </Box>
      </Stack>

      <Divider sx={{ mt: 4, mb: 2 }} />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", textAlign: "center" }}
      >
        {farmName} — Document généré le {formatDate(new Date().toISOString())}
      </Typography>
    </Box>
  );
}
