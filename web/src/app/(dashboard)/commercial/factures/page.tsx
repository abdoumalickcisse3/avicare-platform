"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
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
import { MoreVertical, Plus } from "lucide-react";
import { useGetInvoicesQuery } from "@/store/api/invoicesApi";
import { useGetClientsQuery } from "@/store/api/clientsApi";
import { useGetPaymentsQuery, useVoidPaymentMutation } from "@/store/api/paymentsApi";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { InvoiceDialog } from "@/components/commercial/InvoiceDialog";
import { INVOICE_STATUS_META, PAYMENT_METHOD_LABELS, isInvoiceOverdue } from "@/lib/commercial";
import { formatCurrency, formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { InvoiceStatus, Payment } from "@/types";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;
const monoBold = { ...mono, fontWeight: 700 } as const;

const INVOICE_TABS: { key: string; label: string; status?: InvoiceStatus; overdue?: boolean }[] = [
  { key: "unpaid", label: "À encaisser" },
  { key: "all", label: "Toutes" },
  { key: "ISSUED", label: "Émises", status: "ISSUED" },
  { key: "PARTIALLY_PAID", label: "Partielles", status: "PARTIALLY_PAID" },
  { key: "PAID", label: "Payées", status: "PAID" },
  { key: "overdue", label: "En retard", overdue: true },
];

export default function FacturesPage() {
  const router = useRouter();
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const { showToast } = useToast();
  const skip = !hasFarm || !hasCommercial;
  const { data: invoices, isLoading: invoicesLoading } = useGetInvoicesQuery({ farmId: farmId as number }, { skip });
  const { data: clients } = useGetClientsQuery({ farmId: farmId as number }, { skip });
  const { data: payments, isLoading: paymentsLoading } = useGetPaymentsQuery({ farmId: farmId as number }, { skip });
  const [voidPayment] = useVoidPaymentMutation();
  const [tab, setTab] = useState("unpaid");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [menuItem, setMenuItem] = useState<Payment | null>(null);

  const clientName = useMemo(() => {
    const map = new Map((clients ?? []).map((c) => [c.id, c.displayName]));
    return (id: number | null) => (id == null ? "Comptant" : map.get(id) ?? `Client #${id}`);
  }, [clients]);

  const invoiceNumber = useMemo(() => {
    const map = new Map((invoices ?? []).map((i) => [i.id, i.invoiceNumber]));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [invoices]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: invoices?.length ?? 0 };
    for (const i of invoices ?? []) c[i.status] = (c[i.status] ?? 0) + 1;
    c.overdue = (invoices ?? []).filter(isInvoiceOverdue).length;
    c.unpaid = (invoices ?? []).filter((i) => i.status === "ISSUED" || i.status === "PARTIALLY_PAID").length;
    return c;
  }, [invoices]);

  const paymentsCount = payments?.length ?? 0;

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    if (tab === "unpaid") return invoices.filter((i) => i.status === "ISSUED" || i.status === "PARTIALLY_PAID");
    if (tab === "all") return invoices;
    if (tab === "overdue") return invoices.filter(isInvoiceOverdue);
    return invoices.filter((i) => i.status === tab);
  }, [invoices, tab]);

  const onVoid = async (p: Payment) => {
    setMenuEl(null);
    try {
      await voidPayment({ farmId: farmId as number, id: p.id }).unwrap();
      showToast("Paiement annulé.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  if (hasFarm && !hasCommercial) {
    return <Alert severity="info">Activez le module Commercial pour gérer la facturation.</Alert>;
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
            Factures
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vos factures clients et leur suivi de paiement.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setDialogOpen(true)} disabled={!hasFarm}>
          Nouvelle facture
        </Button>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: `1px solid ${colors.neutral[200]}` }}
      >
        {INVOICE_TABS.map((t) => (
          <Tab key={t.key} value={t.key} label={`${t.label}${counts[t.key] ? ` (${counts[t.key]})` : ""}`} />
        ))}
        <Tab
          key="paiements"
          value="paiements"
          label={`Paiements${paymentsCount ? ` (${paymentsCount})` : ""}`}
        />
      </Tabs>

      {/* Invoices tab content */}
      {tab !== "paiements" && (
        <>
          {invoicesLoading && <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 3 }} />}

          {!invoicesLoading && filteredInvoices.length === 0 && (
            <Box sx={{ textAlign: "center", py: 8, border: (t) => `1px dashed ${t.palette.divider}`, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Aucune facture
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Générez une facture depuis une vente ou une livraison.
              </Typography>
            </Box>
          )}

          {!invoicesLoading && filteredInvoices.length > 0 && (
            <TableContainer sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 3 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>N°</TableCell>
                    <TableCell>Émission</TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Payé</TableCell>
                    <TableCell>Restant</TableCell>
                    <TableCell>Échéance</TableCell>
                    <TableCell>Statut</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredInvoices.map((inv) => {
                    const meta = INVOICE_STATUS_META[inv.status];
                    const overdue = isInvoiceOverdue(inv);
                    return (
                      <TableRow
                        key={inv.id}
                        hover
                        sx={{ cursor: "pointer" }}
                        onClick={() => router.push(`/commercial/factures/${inv.id}`)}
                      >
                        <TableCell sx={mono}>{inv.invoiceNumber}</TableCell>
                        <TableCell>{formatDate(inv.issueDate)}</TableCell>
                        <TableCell>{clientName(inv.clientId)}</TableCell>
                        <TableCell sx={mono}>{formatCurrency(inv.totalXof)}</TableCell>
                        <TableCell sx={mono}>{formatCurrency(inv.amountPaidXof)}</TableCell>
                        <TableCell sx={{ ...monoBold, color: inv.outstandingXof > 0 ? colors.error.main : colors.success.main }}>
                          {formatCurrency(inv.outstandingXof)}
                        </TableCell>
                        <TableCell sx={{ color: overdue ? colors.error.main : undefined, fontWeight: overdue ? 700 : 400 }}>
                          {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                            <Chip label={meta.label} size="small" sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 600 }} />
                            {overdue && (
                              <Chip label="En retard" size="small" sx={{ bgcolor: colors.error.light, color: colors.error.dark, fontWeight: 600 }} />
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* Payments tab content */}
      {tab === "paiements" && (
        <>
          {paymentsLoading && <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 3 }} />}

          {!paymentsLoading && (payments?.length ?? 0) === 0 && (
            <Box sx={{ textAlign: "center", py: 8, border: (t) => `1px dashed ${t.palette.divider}`, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Aucun paiement
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Encaissez une facture depuis sa fiche pour enregistrer un paiement.
              </Typography>
            </Box>
          )}

          {!paymentsLoading && (payments?.length ?? 0) > 0 && (
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
        </>
      )}

      {farmId && <InvoiceDialog open={dialogOpen} onClose={() => setDialogOpen(false)} farmId={farmId} />}
    </Box>
  );
}
