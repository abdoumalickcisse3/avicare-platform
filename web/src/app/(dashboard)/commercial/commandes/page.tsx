"use client";

import { useMemo, useState } from "react";
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
import { useGetOrdersQuery } from "@/store/api/ordersApi";
import { useGetClientsQuery } from "@/store/api/clientsApi";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { OrderDialog } from "@/components/commercial/OrderDialog";
import { ORDER_STATUS_META } from "@/lib/commercial";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { Order, OrderStatus } from "@/types";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;

const TABS: { key: string; label: string; status?: OrderStatus }[] = [
  { key: "all", label: "Toutes" },
  { key: "PENDING", label: "En attente", status: "PENDING" },
  { key: "CONFIRMED", label: "Confirmées", status: "CONFIRMED" },
  { key: "IN_PROGRESS", label: "En préparation", status: "IN_PROGRESS" },
  { key: "DELIVERED", label: "Livrées", status: "DELIVERED" },
  { key: "CANCELLED", label: "Annulées", status: "CANCELLED" },
];

function articlesSummary(order: Order): string {
  if (order.items.length === 0) return "—";
  const first = order.items[0];
  const head = `${formatNumber(first.quantity)}× ${first.articleLabelSnapshot ?? first.articleKey}`;
  return order.items.length > 1 ? `${head} +${order.items.length - 1}` : head;
}

export default function CommandesPage() {
  const router = useRouter();
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const skip = !hasFarm || !hasCommercial;
  const { data: orders, isLoading } = useGetOrdersQuery({ farmId: farmId as number }, { skip });
  const { data: clients } = useGetClientsQuery({ farmId: farmId as number }, { skip });
  const [tab, setTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const clientName = useMemo(() => {
    const map = new Map((clients ?? []).map((c) => [c.id, c.displayName]));
    return (id: number | null) => (id == null ? "—" : map.get(id) ?? `Client #${id}`);
  }, [clients]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders?.length ?? 0 };
    for (const o of orders ?? []) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    if (!orders) return [];
    return tab === "all" ? orders : orders.filter((o) => o.status === tab);
  }, [orders, tab]);

  if (hasFarm && !hasCommercial) {
    return <Alert severity="info">Activez le module Commercial pour gérer les commandes.</Alert>;
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
            Commandes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Les réservations de vos clients, de la prise de commande à la livraison.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={18} />}
          onClick={() => setDialogOpen(true)}
          disabled={!hasFarm}
        >
          Nouvelle commande
        </Button>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: `1px solid ${colors.neutral[200]}` }}
      >
        {TABS.map((t) => (
          <Tab
            key={t.key}
            value={t.key}
            label={`${t.label}${counts[t.key] ? ` (${counts[t.key]})` : ""}`}
          />
        ))}
      </Tabs>

      {isLoading && <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 3 }} />}

      {!isLoading && filtered.length === 0 && (
        <Box
          sx={{
            textAlign: "center",
            py: 8,
            border: (t) => `1px dashed ${t.palette.divider}`,
            borderRadius: 3,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Aucune commande
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Créez une commande pour un client avec le bouton « Nouvelle commande ».
          </Typography>
        </Box>
      )}

      {!isLoading && filtered.length > 0 && (
        <TableContainer sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>N°</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Articles</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Livraison prévue</TableCell>
                <TableCell>Statut</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((o) => {
                const meta = ORDER_STATUS_META[o.status];
                return (
                  <TableRow
                    key={o.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => router.push(`/commercial/commandes/${o.id}`)}
                  >
                    <TableCell sx={mono}>{o.orderNumber}</TableCell>
                    <TableCell>{formatDate(o.orderDate)}</TableCell>
                    <TableCell>{clientName(o.clientId)}</TableCell>
                    <TableCell>{articlesSummary(o)}</TableCell>
                    <TableCell sx={{ ...mono, fontWeight: 700 }}>{formatCurrency(o.totalXof)}</TableCell>
                    <TableCell>
                      {o.expectedDeliveryDate ? formatDate(o.expectedDeliveryDate) : "—"}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={meta.label}
                        size="small"
                        sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 600 }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {farmId && <OrderDialog open={dialogOpen} onClose={() => setDialogOpen(false)} farmId={farmId} />}
    </Box>
  );
}
