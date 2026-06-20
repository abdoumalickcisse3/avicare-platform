"use client";

import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { AlertTriangle, Coins, Users } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";

interface Props {
  activeCount: number;
  totalReceivableXof: number;
  atRiskCount: number;
}

const mono = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
} as const;

/**
 * Three client KPIs for the directory header (Sprint B5-6, per the "Annuaire
 * Clients" Stitch reference): active clients, total receivable (encours) and the
 * number of clients over their credit limit (indicative alert, Décision D26).
 * Pure presentational — the page computes the values from the clients query.
 */
export function ClientsKpis({ activeCount, totalReceivableXof, atRiskCount }: Props) {
  const atRisk = atRiskCount > 0;
  const cards = [
    {
      label: "Clients actifs",
      value: formatNumber(activeCount),
      icon: Users,
      color: colors.primary[500],
    },
    {
      label: "Encours total",
      value: formatCurrency(totalReceivableXof),
      icon: Coins,
      color: colors.accent[500],
    },
    {
      label: "Clients à risque",
      value: formatNumber(atRiskCount),
      icon: AlertTriangle,
      color: atRisk ? colors.error.main : colors.success.main,
      hint: atRisk ? "Limite dépassée" : "Aucun dépassement",
    },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 2, md: 3 },
        gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
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
