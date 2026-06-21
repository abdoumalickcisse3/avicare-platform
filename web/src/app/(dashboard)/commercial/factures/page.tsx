"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
import { AlertTriangle, Coins, Plus, Receipt } from "lucide-react";
import { useGetInvoicesQuery } from "@/store/api/invoicesApi";
import { useGetClientsQuery } from "@/store/api/clientsApi";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { InvoiceDialog } from "@/components/commercial/InvoiceDialog";
import { INVOICE_STATUS_META, isInvoiceOverdue } from "@/lib/commercial";
import { formatCurrency, formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { InvoiceStatus } from "@/types";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;
const monoBold = { ...mono, fontWeight: 700 } as const;

const TABS: { key: string; label: string; status?: InvoiceStatus; overdue?: boolean }[] = [
  { key: "all", label: "Toutes" },
  { key: "ISSUED", label: "Émises", status: "ISSUED" },
  { key: "PARTIALLY_PAID", label: "Partielles", status: "PARTIALLY_PAID" },
  { key: "PAID", label: "Payées", status: "PAID" },
  { key: "overdue", label: "En retard", overdue: true },
];

export default function FacturesPage() {
  const router = useRouter();
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const skip = !hasFarm || !hasCommercial;
  const { data: invoices, isLoading } = useGetInvoicesQuery({ farmId: farmId as number }, { skip });
  const { data: clients } = useGetClientsQuery({ farmId: farmId as number }, { skip });
  const [tab, setTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const clientName = useMemo(() => {
    const map = new Map((clients ?? []).map((c) => [c.id, c.displayName]));
    return (id: number | null) => (id == null ? "Comptant" : map.get(id) ?? `Client #${id}`);
  }, [clients]);

  const kpis = useMemo(() => {
    const list = invoices ?? [];
    const unpaid = list.filter((i) => i.status === "ISSUED" || i.status === "PARTIALLY_PAID");
    return {
      unpaidTotal: unpaid.reduce((s, i) => s + i.outstandingXof, 0),
      overdueCount: list.filter(isInvoiceOverdue).length,
      invoicedTotal: list
        .filter((i) => i.status !== "CANCELLED")
        .reduce((s, i) => s + i.totalXof, 0),
    };
  }, [invoices]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: invoices?.length ?? 0 };
    for (const i of invoices ?? []) c[i.status] = (c[i.status] ?? 0) + 1;
    c.overdue = (invoices ?? []).filter(isInvoiceOverdue).length;
    return c;
  }, [invoices]);

  const filtered = useMemo(() => {
    if (!invoices) return [];
    if (tab === "all") return invoices;
    if (tab === "overdue") return invoices.filter(isInvoiceOverdue);
    return invoices.filter((i) => i.status === tab);
  }, [invoices, tab]);

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

      {!isLoading && (invoices?.length ?? 0) > 0 && (
        <Box
          sx={{
            display: "grid",
            gap: { xs: 2, md: 3 },
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
            mb: 3,
          }}
        >
          <Card>
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Factures impayées
                </Typography>
                <Coins size={18} color={colors.accent[500]} />
              </Stack>
              <Typography variant="h5" sx={{ ...monoBold, mt: 1, color: colors.accent[500] }}>
                {formatCurrency(kpis.unpaidTotal)}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  En retard
                </Typography>
                <AlertTriangle
                  size={18}
                  color={kpis.overdueCount > 0 ? colors.error.main : colors.success.main}
                />
              </Stack>
              <Typography
                variant="h5"
                sx={{ ...monoBold, mt: 1, color: kpis.overdueCount > 0 ? colors.error.main : colors.success.main }}
              >
                {kpis.overdueCount}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  CA facturé
                </Typography>
                <Receipt size={18} color={colors.primary[500]} />
              </Stack>
              <Typography variant="h5" sx={{ ...monoBold, mt: 1, color: colors.primary[500] }}>
                {formatCurrency(kpis.invoicedTotal)}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: `1px solid ${colors.neutral[200]}` }}
      >
        {TABS.map((t) => (
          <Tab key={t.key} value={t.key} label={`${t.label}${counts[t.key] ? ` (${counts[t.key]})` : ""}`} />
        ))}
      </Tabs>

      {isLoading && <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 3 }} />}

      {!isLoading && filtered.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8, border: (t) => `1px dashed ${t.palette.divider}`, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Aucune facture
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Générez une facture depuis une vente ou une livraison.
          </Typography>
        </Box>
      )}

      {!isLoading && filtered.length > 0 && (
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
              {filtered.map((inv) => {
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

      {farmId && <InvoiceDialog open={dialogOpen} onClose={() => setDialogOpen(false)} farmId={farmId} />}
    </Box>
  );
}
