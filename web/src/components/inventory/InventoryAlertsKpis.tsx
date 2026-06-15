"use client";

import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { AlertTriangle, Coins, Package, ShoppingCart } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";

interface Props {
  totalArticles: number;
  lowStockCount: number;
  totalValueXof: number;
  pendingOrdersCount: number;
}

const mono = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
} as const;

/**
 * Four inventory KPIs for the stock overview (Sprint B4-7). Pure presentational —
 * the page computes the values from the stock / valuation / alerts queries.
 */
export function InventoryAlertsKpis({
  totalArticles,
  lowStockCount,
  totalValueXof,
  pendingOrdersCount,
}: Props) {
  const lowStockAlert = lowStockCount > 0;
  const cards = [
    {
      label: "Articles totaux",
      value: formatNumber(totalArticles),
      icon: Package,
      color: colors.primary[500],
    },
    {
      label: "Stock bas",
      value: formatNumber(lowStockCount),
      icon: AlertTriangle,
      color: lowStockAlert ? colors.error.main : colors.success.main,
      hint: lowStockAlert ? "Action requise" : "Tout est en ordre",
    },
    {
      label: "Valeur du stock",
      value: formatCurrency(totalValueXof),
      icon: Coins,
      color: colors.accent[500],
    },
    {
      label: "Bons d'achat en cours",
      value: formatNumber(pendingOrdersCount),
      icon: ShoppingCart,
      color: colors.info.main,
    },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 2, md: 3 },
        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
        mb: 3,
      }}
    >
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label}>
            <CardContent>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {c.label}
                </Typography>
                <Icon size={18} color={c.color} />
              </Stack>
              <Typography variant="h5" sx={{ ...mono, mt: 1, color: c.color }}>
                {c.value}
              </Typography>
              {c.hint && (
                <Typography variant="caption" sx={{ color: c.color, fontWeight: 600 }}>
                  {c.hint}
                </Typography>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
}
