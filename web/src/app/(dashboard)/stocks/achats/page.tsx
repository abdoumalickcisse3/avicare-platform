"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import { Plus } from "lucide-react";
import { useGetPurchaseOrdersQuery } from "@/store/api/purchaseOrdersApi";
import { useInventoryGating } from "@/hooks/useInventoryGating";
import { PurchaseOrderDialog } from "@/components/inventory/PurchaseOrderDialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { PO_STATUS_META } from "@/lib/inventory";
import { colors } from "@/theme/tokens";
import type { PurchaseOrderStatus } from "@/types";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;

const TABS: { key: string; label: string; status?: PurchaseOrderStatus }[] = [
  { key: "all", label: "Tous" },
  { key: "DRAFT", label: "Brouillon", status: "DRAFT" },
  { key: "SENT", label: "Envoyés", status: "SENT" },
  { key: "RECEIVED", label: "Reçus", status: "RECEIVED" },
  { key: "CANCELLED", label: "Annulés", status: "CANCELLED" },
];

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { farmId, hasFarm, hasInventory } = useInventoryGating();
  const [tab, setTab] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const status = TABS.find((t) => t.key === tab)?.status;
  const { data: orders, isLoading } = useGetPurchaseOrdersQuery(
    { farmId: farmId as number, status },
    { skip: !hasFarm || !hasInventory },
  );

  if (hasFarm && !hasInventory) {
    return <Alert severity="info">Activez le module Inventaire pour gérer les bons d&apos;achat.</Alert>;
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Gestion des achats
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Créez et suivez vos commandes fournisseurs.
          </Typography>
        </Box>
        <Button variant="contained" color="primary" startIcon={<Plus size={18} />} onClick={() => setCreateOpen(true)} disabled={!hasFarm}>
          Créer un bon d&apos;achat
        </Button>
      </Stack>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        {TABS.map((t) => (
          <Tab key={t.key} value={t.key} label={t.label} />
        ))}
      </Tabs>

      {isLoading && <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 3 }} />}

      {!isLoading && (orders?.length ?? 0) === 0 && (
        <Box sx={{ textAlign: "center", py: 8, border: (t) => `1px dashed ${t.palette.divider}`, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Aucun bon d&apos;achat
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Créez votre premier bon pour approvisionner votre stock.
          </Typography>
        </Box>
      )}

      {!isLoading && (orders?.length ?? 0) > 0 && (
        <TableContainer sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>N° de bon</TableCell>
                <TableCell>Fournisseur</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Articles</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Statut</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders!.map((po) => {
                const meta = PO_STATUS_META[po.status];
                return (
                  <TableRow
                    key={po.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => router.push(`/stocks/achats/${po.id}`)}
                  >
                    <TableCell sx={{ ...mono, fontWeight: 600 }}>{po.orderNumber}</TableCell>
                    <TableCell>{po.supplierName}</TableCell>
                    <TableCell>{formatDate(po.orderDate)}</TableCell>
                    <TableCell align="right" sx={mono}>
                      {po.items.length}
                    </TableCell>
                    <TableCell align="right" sx={mono}>
                      {po.totalXof != null ? formatCurrency(po.totalXof) : "—"}
                    </TableCell>
                    <TableCell>
                      <Chip label={meta.label} size="small" sx={{ bgcolor: meta.bg, color: meta.fg, fontWeight: 600 }} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {farmId && (
        <PurchaseOrderDialog open={createOpen} onClose={() => setCreateOpen(false)} farmId={farmId} />
      )}
    </Box>
  );
}
