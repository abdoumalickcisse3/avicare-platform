"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { MoreVertical } from "lucide-react";
import { useCancelSaleMutation, useGetSalesQuery } from "@/store/api/salesApi";
import { useGetClientsQuery } from "@/store/api/clientsApi";
import { useGetCatalogQuery } from "@/store/api/catalogApi";
import { channelLabel } from "@/lib/salesChannel";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { SALE_STATUS_META } from "@/lib/commercial";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { Sale } from "@/types";
import { useMemo } from "react";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;
const monoBold = { ...mono, fontWeight: 700 } as const;

function articlesSummary(sale: Sale): string {
  if (sale.items.length === 0) return "—";
  const first = sale.items[0];
  const head = `${formatNumber(first.quantity)}× ${first.articleLabelSnapshot ?? first.articleKey}`;
  return sale.items.length > 1 ? `${head} +${sale.items.length - 1}` : head;
}

export default function VentesPage() {
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const { showToast } = useToast();
  const skip = !hasFarm || !hasCommercial;
  const { data: sales, isLoading } = useGetSalesQuery({ farmId: farmId as number }, { skip });
  const { data: clients } = useGetClientsQuery({ farmId: farmId as number }, { skip });
  const { data: channels } = useGetCatalogQuery(
    { farmId: farmId as number, category: "sales_channels" },
    { skip },
  );
  const [cancelSale] = useCancelSaleMutation();

  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [menuSale, setMenuSale] = useState<Sale | null>(null);

  const clientName = useMemo(() => {
    const map = new Map((clients ?? []).map((c) => [c.id, c.displayName]));
    return (id: number | null) => (id == null ? "Comptant" : map.get(id) ?? `Client #${id}`);
  }, [clients]);


  if (hasFarm && !hasCommercial) {
    return <Alert severity="info">Activez le module Commercial pour enregistrer des ventes.</Alert>;
  }

  const cancel = async (s: Sale) => {
    setMenuEl(null);
    try {
      await cancelSale({ farmId: farmId as number, id: s.id }).unwrap();
      showToast("Vente annulée — stock réintégré.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Ventes directes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Vos ventes au comptant. Utilisez le bouton « Vente directe » pour en enregistrer une.
        </Typography>
      </Box>

      {isLoading && <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 3 }} />}

      {!isLoading && (sales?.length ?? 0) === 0 && (
        <Box
          sx={{
            textAlign: "center",
            py: 8,
            border: (t) => `1px dashed ${t.palette.divider}`,
            borderRadius: 3,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Aucune vente
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enregistrez votre première vente avec le bouton « Vente directe ».
          </Typography>
        </Box>
      )}

      {!isLoading && (sales?.length ?? 0) > 0 && (
        <TableContainer sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>N°</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Circuit</TableCell>
                <TableCell>Articles</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {sales!.map((s) => {
                const meta = SALE_STATUS_META[s.status];
                return (
                  <TableRow key={s.id} hover>
                    <TableCell sx={mono}>{s.saleNumber}</TableCell>
                    <TableCell>{formatDate(s.saleDate)}</TableCell>
                    <TableCell>{clientName(s.clientId)}</TableCell>
                    <TableCell>{channelLabel(channels, s.salesChannelKey) ?? "—"}</TableCell>
                    <TableCell>{articlesSummary(s)}</TableCell>
                    <TableCell sx={monoBold}>{formatCurrency(s.totalXof)}</TableCell>
                    <TableCell>
                      <Chip
                        label={meta.label}
                        size="small"
                        sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {s.status === "COMPLETED" && (
                        <IconButton
                          size="small"
                          aria-label="Actions"
                          onClick={(e) => {
                            setMenuEl(e.currentTarget);
                            setMenuSale(s);
                          }}
                        >
                          <MoreVertical size={18} />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
        <MenuItem onClick={() => menuSale && cancel(menuSale)} sx={{ color: colors.error.main }}>
          Annuler la vente
        </MenuItem>
      </Menu>
    </Box>
  );
}
