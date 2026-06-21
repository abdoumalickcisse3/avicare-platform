"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { AlertTriangle, ChevronRight, Coins, PackageCheck, ShoppingBag, Wallet } from "lucide-react";
import { useGetSalesQuery } from "@/store/api/salesApi";
import { useGetOrdersQuery } from "@/store/api/ordersApi";
import { useGetInvoicesQuery } from "@/store/api/invoicesApi";
import { useGetClientsQuery } from "@/store/api/clientsApi";
import { useCommercialGating } from "@/hooks/useCommercialGating";
import { creditColor, creditRatio, initials, isInvoiceOverdue } from "@/lib/commercial";
import { formatCurrency, formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";

const monoBold = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
} as const;

export default function CommercialCockpitPage() {
  const router = useRouter();
  const { farmId, hasFarm, hasCommercial } = useCommercialGating();
  const skip = !hasFarm || !hasCommercial;
  const { data: sales, isLoading: l1 } = useGetSalesQuery({ farmId: farmId as number }, { skip });
  const { data: orders, isLoading: l2 } = useGetOrdersQuery({ farmId: farmId as number }, { skip });
  const { data: invoices, isLoading: l3 } = useGetInvoicesQuery({ farmId: farmId as number }, { skip });
  const { data: clients, isLoading: l4 } = useGetClientsQuery({ farmId: farmId as number }, { skip });

  const m = useMemo(() => {
    const completedSales = (sales ?? []).filter((s) => s.status === "COMPLETED");
    const openOrders = (orders ?? []).filter(
      (o) => o.status === "PENDING" || o.status === "CONFIRMED" || o.status === "IN_PROGRESS",
    );
    const toDeliver = (orders ?? []).filter((o) => o.status === "IN_PROGRESS");
    const unpaid = (invoices ?? []).filter((i) => i.status === "ISSUED" || i.status === "PARTIALLY_PAID");
    const overdue = (invoices ?? []).filter(isInvoiceOverdue);
    const debtors = (clients ?? [])
      .filter((c) => c.currentBalanceXof > 0)
      .sort((a, b) => b.currentBalanceXof - a.currentBalanceXof)
      .slice(0, 5);
    return {
      salesTotal: completedSales.reduce((s, x) => s + x.totalXof, 0),
      openOrdersCount: openOrders.length,
      unpaidTotal: unpaid.reduce((s, x) => s + x.outstandingXof, 0),
      receivableTotal: (clients ?? []).reduce((s, c) => s + c.currentBalanceXof, 0),
      toDeliver,
      unpaid,
      overdueCount: overdue.length,
      debtors,
    };
  }, [sales, orders, invoices, clients]);

  if (hasFarm && !hasCommercial) {
    return <Alert severity="info">Activez le module Commercial pour ouvrir le tableau de bord.</Alert>;
  }
  const loading = l1 || l2 || l3 || l4;

  const kpi = (label: string, value: string, Icon: typeof Coins, color: string, hint?: string) => (
    <Card>
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
          <Icon size={18} color={color} />
        </Stack>
        <Typography variant="h5" sx={{ ...monoBold, mt: 1, color }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" sx={{ color, fontWeight: 600 }}>
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const worklistRow = (label: string, count: number, href: string, Icon: typeof Coins, color: string) =>
    count > 0 ? (
      <Stack
        key={label}
        direction="row"
        spacing={1.5}
        onClick={() => router.push(href)}
        sx={{
          alignItems: "center",
          py: 1.25,
          px: 1,
          borderRadius: 2,
          cursor: "pointer",
          "&:hover": { bgcolor: colors.neutral[50] },
        }}
      >
        <Avatar sx={{ width: 32, height: 32, bgcolor: colors.neutral[100], color }}>
          <Icon size={17} />
        </Avatar>
        <Typography sx={{ flex: 1, fontWeight: 500 }}>{label}</Typography>
        <Chip label={count} size="small" sx={{ fontWeight: 700 }} />
        <ChevronRight size={16} color={colors.neutral[400]} />
      </Stack>
    ) : null;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Commercial
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Vue d&apos;ensemble de votre activité : ventes, encours et actions à mener.
        </Typography>
      </Box>

      {loading ? (
        <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 3 }} />
      ) : (
        <>
          <Box
            sx={{
              display: "grid",
              gap: { xs: 2, md: 3 },
              gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
              mb: 3,
            }}
          >
            {kpi("Ventes (comptant)", formatCurrency(m.salesTotal), Coins, colors.accent[500])}
            {kpi("Commandes en cours", formatNumber(m.openOrdersCount), ShoppingBag, colors.primary[500])}
            {kpi(
              "Factures impayées",
              formatCurrency(m.unpaidTotal),
              Wallet,
              m.unpaidTotal > 0 ? colors.error.main : colors.success.main,
              m.overdueCount > 0 ? `${m.overdueCount} en retard` : undefined,
            )}
            {kpi("Encours clients", formatCurrency(m.receivableTotal), AlertTriangle, colors.info.main)}
          </Box>

          <Box
            sx={{
              display: "grid",
              gap: { xs: 2, md: 3 },
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            }}
          >
            {/* Worklist */}
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  À faire
                </Typography>
                {m.toDeliver.length === 0 && m.unpaid.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Rien à traiter — tout est à jour. 🎉
                  </Typography>
                ) : (
                  <Stack>
                    {worklistRow(
                      "Commandes à livrer",
                      m.toDeliver.length,
                      "/commercial/commandes",
                      PackageCheck,
                      colors.accent[600],
                    )}
                    {worklistRow(
                      "Factures à encaisser",
                      m.unpaid.length,
                      "/commercial/factures",
                      Wallet,
                      colors.error.main,
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>

            {/* Top debtors */}
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Ils me doivent
                </Typography>
                {m.debtors.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Aucun encours client.
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {m.debtors.map((c) => {
                      const ratio = creditRatio(c);
                      const color = creditColor(c);
                      return (
                        <Stack
                          key={c.id}
                          direction="row"
                          spacing={1.5}
                          onClick={() => router.push(`/commercial/clients/${c.id}`)}
                          sx={{ alignItems: "center", cursor: "pointer" }}
                        >
                          <Avatar
                            sx={{ width: 32, height: 32, bgcolor: colors.primary[100], color: colors.primary[700], fontSize: 13, fontWeight: 700 }}
                          >
                            {initials(c.displayName)}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography noWrap sx={{ fontWeight: 600 }}>
                              {c.displayName}
                            </Typography>
                            {ratio != null && (
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(ratio * 100, 100)}
                                sx={{
                                  height: 5,
                                  borderRadius: 3,
                                  mt: 0.5,
                                  bgcolor: colors.neutral[200],
                                  "& .MuiLinearProgress-bar": { bgcolor: color },
                                }}
                              />
                            )}
                          </Box>
                          <Typography sx={{ ...monoBold, color }}>
                            {formatCurrency(c.currentBalanceXof)}
                          </Typography>
                        </Stack>
                      );
                    })}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Box>
        </>
      )}
    </Box>
  );
}
