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
import { useGetPaymentsQuery, useVoidPaymentMutation } from "@/store/api/paymentsApi";
import { useGetInvoicesQuery } from "@/store/api/invoicesApi";
import { useGetClientsQuery } from "@/store/api/clientsApi";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { PAYMENT_METHOD_LABELS } from "@/lib/commercial";
import { formatCurrency, formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { Payment } from "@/types";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;

export default function PaiementsPage() {
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const { showToast } = useToast();
  const skip = !hasFarm || !hasCommercial;
  const { data: payments, isLoading } = useGetPaymentsQuery({ farmId: farmId as number }, { skip });
  const { data: invoices } = useGetInvoicesQuery({ farmId: farmId as number }, { skip });
  const { data: clients } = useGetClientsQuery({ farmId: farmId as number }, { skip });
  const [voidPayment] = useVoidPaymentMutation();
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [menuItem, setMenuItem] = useState<Payment | null>(null);

  const invoiceNumber = useMemo(() => {
    const map = new Map((invoices ?? []).map((i) => [i.id, i.invoiceNumber]));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [invoices]);
  const clientName = useMemo(() => {
    const map = new Map((clients ?? []).map((c) => [c.id, c.displayName]));
    return (id: number | null) => (id == null ? "Comptant" : map.get(id) ?? `Client #${id}`);
  }, [clients]);

  if (hasFarm && !hasCommercial) {
    return <Alert severity="info">Activez le module Commercial pour suivre les paiements.</Alert>;
  }

  const onVoid = async (p: Payment) => {
    setMenuEl(null);
    try {
      await voidPayment({ farmId: farmId as number, id: p.id }).unwrap();
      showToast("Paiement annulé.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Paiements
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Les encaissements sur vos factures.
        </Typography>
      </Box>

      {isLoading && <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 3 }} />}

      {!isLoading && (payments?.length ?? 0) === 0 && (
        <Box sx={{ textAlign: "center", py: 8, border: (t) => `1px dashed ${t.palette.divider}`, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Aucun paiement
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Encaissez une facture depuis sa fiche pour enregistrer un paiement.
          </Typography>
        </Box>
      )}

      {!isLoading && (payments?.length ?? 0) > 0 && (
        <TableContainer sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>N°</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Facture</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Montant</TableCell>
                <TableCell>Méthode</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {payments!.map((p) => {
                const cancelled = p.status === "CANCELLED";
                return (
                  <TableRow key={p.id} hover sx={{ opacity: cancelled ? 0.55 : 1 }}>
                    <TableCell sx={mono}>{p.paymentNumber}</TableCell>
                    <TableCell>{formatDate(p.paymentDate)}</TableCell>
                    <TableCell sx={mono}>{invoiceNumber(p.invoiceId)}</TableCell>
                    <TableCell>{clientName(p.clientId)}</TableCell>
                    <TableCell sx={{ ...mono, fontWeight: 700 }}>{formatCurrency(p.amountXof)}</TableCell>
                    <TableCell>{PAYMENT_METHOD_LABELS[p.method]}</TableCell>
                    <TableCell>
                      <Chip
                        label={cancelled ? "Annulé" : "Validé"}
                        size="small"
                        sx={{
                          bgcolor: cancelled ? colors.neutral[200] : colors.success.light,
                          color: cancelled ? colors.neutral[600] : colors.success.dark,
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {!cancelled && (
                        <IconButton
                          size="small"
                          aria-label="Actions"
                          onClick={(e) => {
                            setMenuEl(e.currentTarget);
                            setMenuItem(p);
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
        <MenuItem onClick={() => menuItem && onVoid(menuItem)} sx={{ color: colors.error.main }}>
          Annuler le paiement
        </MenuItem>
      </Menu>
    </Box>
  );
}
