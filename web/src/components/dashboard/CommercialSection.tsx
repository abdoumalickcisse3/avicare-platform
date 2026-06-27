"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import {
  AlertTriangle,
  Package,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { colors } from "@/theme/tokens";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { KpiCard } from "@/components/dashboard/KpiCard";
import type { CommercialSection as CommercialSectionData } from "@/types/dashboard";

interface Props {
  data: CommercialSectionData;
}

// ── Revenue time-series chart ─────────────────────────────────────────────────

function RevenueChart({ series }: { series: CommercialSectionData["revenueSeries"] }) {
  if (series.length === 0) {
    return (
      <Box
        sx={{
          height: 220,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Aucune donnée de chiffre d&apos;affaires pour la période.
        </Typography>
      </Box>
    );
  }

  const data = series.map((p) => ({
    date: formatDate(p.date),
    ca: p.valueXof,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.primary[500]} stopOpacity={0.3} />
            <stop offset="95%" stopColor={colors.primary[500]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={colors.neutral[200]}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: colors.neutral[500] }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: colors.neutral[500] }}
          tickFormatter={(v: number) => formatNumber(v)}
        />
        <Tooltip
          formatter={(value) =>
            typeof value === "number" ? [formatCurrency(value), "CA"] : [value, "CA"]
          }
        />
        <Area
          type="monotone"
          dataKey="ca"
          stroke={colors.primary[500]}
          strokeWidth={2}
          fill="url(#revenueGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Top-N ranked list (clients or debtors) ────────────────────────────────────

function TopList({
  title,
  entries,
  emptyLabel,
}: {
  title: string;
  entries: CommercialSectionData["topClients"];
  emptyLabel: string;
}) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        {title}
      </Typography>
      {entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {emptyLabel}
        </Typography>
      ) : (
        <Stack divider={<Divider />} spacing={0}>
          {entries.map((e, idx) => (
            <Box
              key={e.clientId}
              component={Link}
              href={`/commercial/clients/${e.clientId}`}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                py: 1,
                textDecoration: "none",
                color: "inherit",
                "&:hover": { bgcolor: "action.hover", borderRadius: 1 },
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography
                  variant="caption"
                  sx={{
                    width: 20,
                    textAlign: "center",
                    color: "text.secondary",
                  }}
                >
                  {idx + 1}
                </Typography>
                <Typography variant="body2">{e.name}</Typography>
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {formatCurrency(e.valueXof)}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

// ── Main exported section ─────────────────────────────────────────────────────

export function CommercialSection({ data }: Props) {
  const kpis = [
    {
      label: "CA période",
      value: formatCurrency(data.revenueXof),
      icon: TrendingUp,
      tint: colors.primary[500],
    },
    {
      label: "Encours clients",
      value: formatCurrency(data.outstandingXof),
      icon: Users,
      tint: colors.info.main,
    },
    {
      label: "Impayés",
      value: formatCurrency(data.overdueXof),
      icon: AlertTriangle,
      tint: colors.error.main,
    },
    {
      label: "Cmd. à livrer",
      value: formatNumber(data.ordersToDeliver),
      icon: Package,
      tint: colors.accent[400],
    },
    {
      label: "Fact. à encaisser",
      value: formatNumber(data.invoicesToCollect),
      icon: Receipt,
      tint: colors.warning.main,
    },
  ];

  return (
    <Stack spacing={3}>
      {/* Section heading */}
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Commercial
      </Typography>

      {/* KPI row */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
            lg: "repeat(5, 1fr)",
          },
        }}
      >
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            tint={k.tint}
          />
        ))}
      </Box>

      {/* Revenue chart */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Évolution du CA
          </Typography>
          <RevenueChart series={data.revenueSeries} />
        </CardContent>
      </Card>

      {/* Top clients / top débiteurs */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
        }}
      >
        <Card>
          <CardContent>
            <TopList
              title="Top clients (CA)"
              entries={data.topClients}
              emptyLabel="Aucun client pour la période."
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <TopList
              title="Top débiteurs (encours)"
              entries={data.topDebtors}
              emptyLabel="Aucun encours client."
            />
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
