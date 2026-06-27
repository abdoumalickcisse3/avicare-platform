"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import {
  Activity,
  AlertTriangle,
  Bird,
  Scale,
  Shield,
  Stethoscope,
  TrendingDown,
  Users,
} from "lucide-react";
import { colors } from "@/theme/tokens";
import { formatDate, formatNumber } from "@/lib/format";
import { KpiCard } from "@/components/dashboard/KpiCard";
import type { LivestockSection as LivestockSectionData } from "@/types/dashboard";

interface Props {
  data: LivestockSectionData;
}

// ── Mortality series chart ────────────────────────────────────────────────────

function MortalitySeriesChart({
  series,
}: {
  series: LivestockSectionData["mortalitySeries"];
}) {
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
          Aucune donnée de mortalité pour la période.
        </Typography>
      </Box>
    );
  }

  const chartData = series.map((p) => ({
    date: formatDate(p.date),
    morts: p.valueXof,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
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
          allowDecimals={false}
        />
        <Tooltip
          formatter={(value) =>
            typeof value === "number"
              ? [formatNumber(value), "Morts"]
              : [value, "Morts"]
          }
        />
        <Bar dataKey="morts" fill={colors.error.main} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Laying series chart ───────────────────────────────────────────────────────

function LayingSeriesChart({
  series,
}: {
  series: LivestockSectionData["layingSeries"];
}) {
  const chartData = series.map((p) => ({
    date: formatDate(p.date),
    oeufs: p.valueXof,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
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
            typeof value === "number"
              ? [formatNumber(value), "Œufs"]
              : [value, "Œufs"]
          }
        />
        <Line
          type="monotone"
          dataKey="oeufs"
          stroke={colors.primary[500]}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Main exported section ─────────────────────────────────────────────────────

export function LivestockSection({ data }: Props) {
  // Conditional KPIs — collected into a single array to avoid hook ordering issues.
  const kpis = [
    {
      label: "Bandes actives",
      value: formatNumber(data.activeBatches),
      icon: Bird,
      tint: colors.accent[400],
    },
    {
      label: "Effectif vivant",
      value: formatNumber(data.totalHeadcount),
      icon: Users,
      tint: colors.primary[500],
    },
    {
      label: "Morts",
      value: formatNumber(data.deaths),
      icon: AlertTriangle,
      tint: colors.error.main,
    },
    // Taux mortalité — only when mortalityRate is non-null/undefined
    ...(data.mortalityRate != null
      ? [
          {
            label: "Taux mortalité",
            value: `${formatNumber(data.mortalityRate)} %`,
            icon: TrendingDown,
            tint: colors.error.main,
          },
        ]
      : []),
    // GMQ — only when avgDailyGainG is non-null/undefined (broiler only)
    ...(data.avgDailyGainG != null
      ? [
          {
            label: "GMQ",
            value: `${formatNumber(data.avgDailyGainG)} g/j`,
            icon: Scale,
            tint: colors.success.main,
          },
        ]
      : []),
    // Taux de ponte — only when layingRate is non-null/undefined (layer only)
    ...(data.layingRate != null
      ? [
          {
            label: "Taux de ponte",
            value: `${formatNumber(data.layingRate)} %`,
            icon: Activity,
            tint: colors.info.main,
          },
        ]
      : []),
    {
      label: "Vaccinations",
      value: formatNumber(data.vaccinationsCount),
      icon: Shield,
      tint: colors.vet.main,
    },
    {
      label: "Traitements",
      value: formatNumber(data.treatmentsCount),
      icon: Stethoscope,
      tint: colors.warning.main,
    },
  ];

  const hasLayingSeries = data.layingSeries.length > 0;

  return (
    <Stack spacing={3}>
      {/* Section heading */}
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Élevage
      </Typography>

      {/* KPI grid — adaptive column count */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
            lg: "repeat(4, 1fr)",
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

      {/* Mortality time-series chart — always mounted, handles empty state internally */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Mortalité journalière
          </Typography>
          <MortalitySeriesChart series={data.mortalitySeries} />
        </CardContent>
      </Card>

      {/* Laying series chart — only when egg-count data is present */}
      {hasLayingSeries && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Production d&apos;œufs journalière
            </Typography>
            <LayingSeriesChart series={data.layingSeries} />
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
