"use client";

import {
  Box,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { Bird, Calendar, TrendingUp, Wheat } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  useGetDailyRecordsQuery,
  useGetPerformanceQuery,
  useGetWeighingsQuery,
} from "@/store/api/poultryBatchesApi";
import { formatNumber } from "@/lib/format";
import { ageInDays, daysUntil, scoreMeta } from "@/lib/poultry";
import { colors } from "@/theme/tokens";
import { GrowthChart } from "./charts/GrowthChart";
import { MortalityChart } from "./charts/MortalityChart";
import { FeedConsumptionChart } from "./charts/FeedConsumptionChart";
import type { PoultryBatch } from "@/types";

const DASH = "—";
const monoSx = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
} as const;

function KpiCard({
  label,
  value,
  unit,
  hint,
  icon,
  tint,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: string;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mt: 0.5 }}>
              <Typography sx={{ ...monoSx, fontSize: "1.5rem", color: colors.neutral[800] }}>
                {value}
              </Typography>
              {unit && (
                <Typography variant="caption" color="text.secondary">
                  {unit}
                </Typography>
              )}
            </Box>
            {hint && (
              <Typography variant="caption" color="text.secondary">
                {hint}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: `${tint}1A`,
              color: tint,
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function BatchOverviewTab({
  farmId,
  batch,
}: {
  farmId: number;
  batch: PoultryBatch;
}) {
  const { data: perf } = useGetPerformanceQuery(
    { farmId, batchId: batch.id },
    { skip: batch.status === "PLANNED" },
  );
  const { data: weighings, isLoading: wLoading } = useGetWeighingsQuery({
    farmId,
    batchId: batch.id,
  });
  const { data: records, isLoading: rLoading } = useGetDailyRecordsQuery({
    farmId,
    batchId: batch.id,
  });

  const age = ageInDays(batch.startDate);
  const score = scoreMeta(perf?.performanceScore ?? null);
  const forecast = perf?.forecastedTargetDate;
  const daysLeft = daysUntil(forecast);

  return (
    <Stack spacing={3}>
      {/* KPI row */}
      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" },
        }}
      >
        <KpiCard
          label="Effectif actuel"
          value={formatNumber(batch.currentCount)}
          unit="sujets"
          icon={<Bird size={20} />}
          tint={colors.primary[500]}
        />
        <KpiCard
          label="Progression (jour)"
          value={age}
          unit={`/ ${batch.targetAgeDays ?? "?"}`}
          icon={<Calendar size={20} />}
          tint={colors.info.main}
        />
        <KpiCard
          label="GMQ (vs objectif)"
          value={perf?.gmqGPerDay != null ? Math.round(perf.gmqGPerDay) : DASH}
          unit="g/j"
          icon={<TrendingUp size={20} />}
          tint={colors.success.main}
        />
        <KpiCard
          label="IC (FCR)"
          value={perf?.feedConversionRatio != null ? perf.feedConversionRatio : DASH}
          hint="Indice de consommation"
          icon={<Wheat size={20} />}
          tint={colors.accent[400]}
        />
      </Box>

      {/* Growth + maturity */}
      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" },
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Courbe de croissance
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Poids moyen (g) réel vs objectif souche
            </Typography>
            {wLoading ? (
              <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />
            ) : (
              <GrowthChart
                weighings={weighings ?? []}
                targetWeightG={batch.targetWeightG}
                targetAgeDays={batch.targetAgeDays}
              />
            )}
          </CardContent>
        </Card>

        <Card
          sx={{
            background: `linear-gradient(160deg, ${colors.primary[600]} 0%, ${colors.primary[800]} 100%)`,
            color: colors.neutral[0],
          }}
        >
          <CardContent>
            <Typography variant="caption" sx={{ opacity: 0.8, textTransform: "uppercase" }}>
              Prévision
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mb: 1 }}>
              Maturité estimée
            </Typography>
            {forecast ? (
              <>
                <Typography sx={{ ...monoSx, fontSize: "2rem" }}>
                  {format(new Date(forecast), "dd MMM yyyy", { locale: fr })}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.85, mt: 1 }}>
                  Jours restants :{" "}
                  <Box component="span" sx={monoSx}>
                    {daysLeft}
                  </Box>
                </Typography>
              </>
            ) : (
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Disponible après la première pesée.
              </Typography>
            )}
            {score && (
              <Box
                sx={{
                  mt: 2,
                  display: "inline-block",
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 999,
                  bgcolor: "rgba(255,255,255,0.18)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                {score.label}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Mortality + feed */}
      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Mortalité quotidienne
            </Typography>
            {rLoading ? (
              <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
            ) : (
              <MortalityChart records={records ?? []} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Consommation cumulée
            </Typography>
            {rLoading ? (
              <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
            ) : (
              <FeedConsumptionChart records={records ?? []} />
            )}
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
