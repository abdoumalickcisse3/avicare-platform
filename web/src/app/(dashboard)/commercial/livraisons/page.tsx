"use client";

import { useMemo, useState } from "react";
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
import { useCancelDeliveryMutation, useGetDeliveriesQuery } from "@/store/api/deliveriesApi";
import { useGetOrdersQuery } from "@/store/api/ordersApi";
import { useGetClientsQuery } from "@/store/api/clientsApi";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { DELIVERY_STATUS_META } from "@/lib/commercial";
import { formatCurrency, formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { Delivery } from "@/types";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;

export default function LivraisonsPage() {
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const { showToast } = useToast();
  const skip = !hasFarm || !hasCommercial;
  const { data: deliveries, isLoading } = useGetDeliveriesQuery({ farmId: farmId as number }, { skip });
  const { data: orders } = useGetOrdersQuery({ farmId: farmId as number }, { skip });
  const { data: clients } = useGetClientsQuery({ farmId: farmId as number }, { skip });
  const [cancelDelivery] = useCancelDeliveryMutation();

  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [menuItem, setMenuItem] = useState<Delivery | null>(null);

  const orderNumber = useMemo(() => {
    const map = new Map((orders ?? []).map((o) => [o.id, o.orderNumber]));
    return (id: number | null) => (id == null ? "—" : map.get(id) ?? `#${id}`);
  }, [orders]);
  const clientName = useMemo(() => {
    const map = new Map((clients ?? []).map((c) => [c.id, c.displayName]));
    return (id: number | null) => (id == null ? "—" : map.get(id) ?? `Client #${id}`);
  }, [clients]);

  if (hasFarm && !hasCommercial) {
    return <Alert severity="info">Activez le module Commercial pour suivre les livraisons.</Alert>;
  }

  const cancel = async (d: Delivery) => {
    setMenuEl(null);
    try {
      await cancelDelivery({ farmId: farmId as number, id: d.id }).unwrap();
      showToast("Livraison annulée — commande rouverte, stock réintégré.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Livraisons
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Les livraisons issues de vos commandes confirmées.
        </Typography>
      </Box>

      {isLoading && <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 3 }} />}

      {!isLoading && (deliveries?.length ?? 0) === 0 && (
        <Box
          sx={{
            textAlign: "center",
            py: 8,
            border: (t) => `1px dashed ${t.palette.divider}`,
            borderRadius: 3,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Aucune livraison
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Livrez une commande « en préparation » depuis sa fiche pour créer une livraison.
          </Typography>
        </Box>
      )}

      {!isLoading && (deliveries?.length ?? 0) > 0 && (
        <TableContainer sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>N°</TableCell>
                <TableCell>Commande</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Transporteur</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {deliveries!.map((d) => {
                const meta = DELIVERY_STATUS_META[d.status];
                return (
                  <TableRow key={d.id} hover>
                    <TableCell sx={mono}>{d.deliveryNumber}</TableCell>
                    <TableCell sx={mono}>{orderNumber(d.orderId)}</TableCell>
                    <TableCell>{formatDate(d.deliveryDate)}</TableCell>
                    <TableCell>{clientName(d.clientId)}</TableCell>
                    <TableCell>{d.carrier ?? "—"}</TableCell>
                    <TableCell sx={{ ...mono, fontWeight: 700 }}>{formatCurrency(d.totalXof)}</TableCell>
                    <TableCell>
                      <Chip
                        label={meta.label}
                        size="small"
                        sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {d.status === "DELIVERED" && (
                        <IconButton
                          size="small"
                          aria-label="Actions"
                          onClick={(e) => {
                            setMenuEl(e.currentTarget);
                            setMenuItem(d);
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
        <MenuItem onClick={() => menuItem && cancel(menuItem)} sx={{ color: colors.error.main }}>
          Annuler la livraison
        </MenuItem>
      </Menu>
    </Box>
  );
}
