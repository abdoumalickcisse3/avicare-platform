"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Avatar,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  List,
  ListItem,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import {
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Power,
  ShoppingCart,
  Tag,
  Wallet,
} from "lucide-react";
import {
  useDeactivateClientMutation,
  useGetClientQuery,
} from "@/store/api/clientsApi";
import { useGetOrdersQuery } from "@/store/api/ordersApi";
import { useGetSalesQuery } from "@/store/api/salesApi";
import { useGetInvoicesQuery } from "@/store/api/invoicesApi";
import { useGetPaymentsQuery } from "@/store/api/paymentsApi";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { ClientDialog } from "./ClientDialog";
import { OrderDialog } from "./OrderDialog";
import { PaymentDialog } from "./PaymentDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import {
  CLIENT_TYPE_LABELS,
  buildClientTimeline,
  creditColor,
  creditRatio,
  initials,
} from "@/lib/commercial";
import type { TimelineKind } from "@/lib/commercial";
import { formatCurrency, formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { Invoice } from "@/types";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;

function TimelineIcon({ kind }: { kind: TimelineKind }) {
  const size = 15;
  switch (kind) {
    case "order":
      return <ShoppingCart size={size} />;
    case "sale":
      return <Tag size={size} />;
    case "invoice":
      return <FileText size={size} />;
    case "payment":
      return <Wallet size={size} />;
  }
}

export function ClientDetailView({ clientId }: { clientId: number }) {
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const { showToast } = useToast();
  const skip = !hasFarm || !hasCommercial;

  // ── Data fetching — all hooks before early returns ────────────────────────
  const { data: client, isLoading } = useGetClientQuery(
    { farmId: farmId as number, id: clientId },
    { skip },
  );
  const { data: orders } = useGetOrdersQuery(
    { farmId: farmId as number, clientId },
    { skip },
  );
  const { data: allSales } = useGetSalesQuery({ farmId: farmId as number }, { skip });
  const { data: allInvoices } = useGetInvoicesQuery({ farmId: farmId as number }, { skip });
  const { data: allPayments } = useGetPaymentsQuery({ farmId: farmId as number }, { skip });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const [deactivate] = useDeactivateClientMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);

  // ── Derived state (after hooks, before early returns) ─────────────────────
  const sales = useMemo(
    () => (allSales ?? []).filter((s) => s.clientId === clientId),
    [allSales, clientId],
  );
  const invoices = useMemo(
    () => (allInvoices ?? []).filter((i) => i.clientId === clientId),
    [allInvoices, clientId],
  );
  const payments = useMemo(
    () => (allPayments ?? []).filter((p) => p.clientId === clientId),
    [allPayments, clientId],
  );

  const timeline = useMemo(
    () =>
      buildClientTimeline({
        orders: orders ?? [],
        sales,
        invoices,
        payments,
      }),
    [orders, sales, invoices, payments],
  );

  // First unpaid invoice to enable "Encaisser"
  const unpaidInvoice = useMemo(
    () => invoices.find((i) => i.outstandingXof > 0 && i.status !== "CANCELLED" && i.status !== "PAID") ?? null,
    [invoices],
  );

  // ── Early returns (after all hooks) ──────────────────────────────────────
  if (hasFarm && !hasCommercial) {
    return <Alert severity="info">Activez le module Commercial pour consulter ce client.</Alert>;
  }
  if (isLoading) return <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 3 }} />;
  if (!client) return <Alert severity="error">Client introuvable.</Alert>;

  const ratio = creditRatio(client);
  const color = creditColor(client);

  const onDeactivate = async () => {
    try {
      await deactivate({ farmId: farmId as number, id: client.id }).unwrap();
      showToast("Client désactivé.", "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link href="/commercial/clients" style={{ color: colors.neutral[500], textDecoration: "none" }}>
          Clients
        </Link>
        <Typography color="text.primary">{client.displayName}</Typography>
      </Breadcrumbs>

      {/* Header: identity + status + actions */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Avatar
            sx={{
              width: 52,
              height: 52,
              bgcolor: colors.primary[100],
              color: colors.primary[700],
              fontWeight: 700,
            }}
          >
            {initials(client.displayName)}
          </Avatar>
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {client.displayName}
              </Typography>
              <Chip label={CLIENT_TYPE_LABELS[client.clientType]} size="small" variant="outlined" />
              <Chip
                label={client.active ? "Actif" : "Inactif"}
                size="small"
                sx={{
                  bgcolor: client.active ? colors.success.light : colors.neutral[200],
                  color: client.active ? colors.success.dark : colors.neutral[600],
                  fontWeight: 600,
                }}
              />
            </Stack>
            {client.legalName && (
              <Typography variant="body2" color="text.secondary">
                {client.legalName}
              </Typography>
            )}
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }} useFlexGap>
          {unpaidInvoice && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<Wallet size={16} />}
              onClick={() => setPayInvoice(unpaidInvoice)}
            >
              Encaisser
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<ShoppingCart size={16} />}
            onClick={() => setOrderOpen(true)}
          >
            Nouvelle commande
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<Power size={16} />}
            onClick={onDeactivate}
            disabled={!client.active}
          >
            Désactiver
          </Button>
          <Button variant="outlined" color="inherit" startIcon={<Pencil size={16} />} onClick={() => setEditOpen(true)}>
            Éditer
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
        }}
      >
        {/* Encours — the signature card */}
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Encours actuel
            </Typography>
            <Typography variant="h3" sx={{ ...mono, fontWeight: 700, color, mt: 0.5 }}>
              {formatCurrency(client.currentBalanceXof)}
            </Typography>
            {ratio != null ? (
              <Box sx={{ mt: 1.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(ratio * 100, 100)}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: colors.neutral[200],
                    "& .MuiLinearProgress-bar": { bgcolor: color },
                  }}
                />
                <Typography variant="caption" sx={{ color: colors.neutral[600], mt: 0.5, display: "block" }}>
                  {Math.round(ratio * 100)}% de la limite de {formatCurrency(client.creditLimitXof!)}
                  {ratio > 1 && " — dépassée"}
                </Typography>
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                Aucune limite de crédit définie
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Contact
            </Typography>
            <Stack spacing={1} sx={{ mt: 1.5, color: colors.neutral[700], fontSize: 14 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Phone size={15} /> <span>{client.phone ?? "—"}</span>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Mail size={15} /> <span>{client.email ?? "—"}</span>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <MapPin size={15} />
                <span>{[client.address, client.city].filter(Boolean).join(", ") || "—"}</span>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Historique commercial — compte courant timeline */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
            Historique commercial
          </Typography>
          {timeline.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucune activité commerciale enregistrée pour ce client.
            </Typography>
          ) : (
            <List disablePadding>
              {timeline.map((entry, idx) => (
                <Box key={`${entry.kind}-${entry.id}`}>
                  <ListItem
                    disableGutters
                    disablePadding
                    component={Link}
                    href={entry.href}
                    sx={{
                      py: 1.25,
                      px: 0,
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 1.5,
                      color: "inherit",
                      textDecoration: "none",
                      "&:hover": { bgcolor: colors.neutral[50], borderRadius: 1 },
                      cursor: "pointer",
                    }}
                  >
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        bgcolor:
                          entry.kind === "payment"
                            ? colors.success.light
                            : entry.kind === "invoice"
                              ? colors.accent[100]
                              : entry.kind === "order"
                                ? colors.primary[100]
                                : colors.neutral[100],
                        color:
                          entry.kind === "payment"
                            ? colors.success.dark
                            : entry.kind === "invoice"
                              ? colors.accent[700]
                              : entry.kind === "order"
                                ? colors.primary[700]
                                : colors.neutral[600],
                      }}
                    >
                      <TimelineIcon kind={entry.kind} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                        {entry.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(entry.date)}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        ...mono,
                        fontWeight: 700,
                        flexShrink: 0,
                        color:
                          entry.kind === "payment" ? colors.success.dark : colors.neutral[800],
                      }}
                    >
                      {formatCurrency(entry.amountXof)}
                    </Typography>
                  </ListItem>
                  {idx < timeline.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {farmId && (
        <ClientDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          farmId={farmId}
          client={client}
        />
      )}
      {farmId && (
        <OrderDialog
          open={orderOpen}
          onClose={() => setOrderOpen(false)}
          farmId={farmId}
          defaultClientId={clientId}
        />
      )}
      {farmId && payInvoice && (
        <PaymentDialog
          open={payInvoice != null}
          onClose={() => setPayInvoice(null)}
          farmId={farmId}
          invoice={payInvoice}
        />
      )}
    </Box>
  );
}
