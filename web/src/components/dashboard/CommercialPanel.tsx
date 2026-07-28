"use client";

import { Box, Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import { colors } from "@/theme/tokens";
import { formatCurrency, formatNumber } from "@/lib/format";
import { TopBars } from "@/components/dashboard/charts/RechartsWidgets";
import { MiniStat } from "@/components/dashboard/MiniStat";
import type { CommercialSection } from "@/types/dashboard";

/**
 * "Commercial" detail panel — the secondary commercial statistics that don't
 * fit the headline KPI row: client balance, overdue, pipeline counts, and the
 * top clients / debtors ranked as horizontal bars (Recharts).
 */
export function CommercialPanel({ data }: { data: CommercialSection }) {
  const topClients = (data.topClients ?? []).map((e) => ({ name: e.name, value: e.valueXof }));
  const topDebtors = (data.topDebtors ?? []).map((e) => ({ name: e.name, value: e.valueXof }));

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography sx={{ fontWeight: 700, fontSize: "1rem", mb: 1.5 }}>Commercial</Typography>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.25 }}>
          <MiniStat label="Encours clients" value={formatCurrency(data.outstandingXof)} tint={colors.info.main} />
          <MiniStat
            label="Impayés (retard)"
            value={formatCurrency(data.overdueXof)}
            tint={colors.warning.main}
            alert={data.overdueXof > 0}
          />
          <MiniStat label="Commandes à livrer" value={formatNumber(data.ordersToDeliver)} tint={colors.accent[400]} />
          <MiniStat label="Factures à encaisser" value={formatNumber(data.invoicesToCollect)} tint={colors.primary[500]} />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Top clients (CA)
            </Typography>
            <TopBars rows={topClients} color={colors.primary[500]} format={formatCurrency} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Top débiteurs (encours)
            </Typography>
            <TopBars rows={topDebtors} color={colors.warning.main} format={formatCurrency} />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
