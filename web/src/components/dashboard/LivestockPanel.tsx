"use client";

import { Box, Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import { colors } from "@/theme/tokens";
import { formatNumber } from "@/lib/format";
import { RadialGauge } from "@/components/dashboard/charts/RechartsWidgets";
import { MiniStat } from "@/components/dashboard/MiniStat";
import type { LivestockSection } from "@/types/dashboard";

/**
 * "Cheptel" detail panel — the livestock statistics: headcount / batches /
 * deaths / vaccinations / treatments as dense mini-stats, plus radial gauges
 * (Recharts) for the mortality and laying rates when the backend provides them
 * (they're module-dependent: laying for layers, GMQ for broilers).
 */
export function LivestockPanel({ data }: { data: LivestockSection }) {
  const hasMortalityRate = data.mortalityRate != null;
  const hasLayingRate = data.layingRate != null;
  const hasGMQ = data.avgDailyGainG != null;
  const hasFeed = data.dailyFeedKg != null;

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography sx={{ fontWeight: 700, fontSize: "1rem", mb: 1.5 }}>Cheptel</Typography>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.25 }}>
          <MiniStat label="Effectif vivant" value={formatNumber(data.totalHeadcount)} tint={colors.primary[500]} />
          <MiniStat label="Lots actifs" value={formatNumber(data.activeBatches)} tint={colors.info.main} />
          <MiniStat label="Mortalité (période)" value={formatNumber(data.deaths)} tint={colors.error.main} alert={data.deaths > 0} />
          {hasGMQ && <MiniStat label="GMQ" value={`${formatNumber(data.avgDailyGainG!)} g/j`} tint={colors.success.main} />}
          {hasFeed && <MiniStat label="Aliment" value={`${formatNumber(data.dailyFeedKg!)} kg/j`} tint={colors.accent[400]} />}
          <MiniStat label="Vaccinations" value={formatNumber(data.vaccinationsCount)} tint={colors.success.main} />
          <MiniStat label="Traitements" value={formatNumber(data.treatmentsCount)} tint={colors.vet.main} />
        </Box>

        {(hasMortalityRate || hasLayingRate) && (
          <>
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" spacing={2} sx={{ justifyContent: "space-around", flexWrap: "wrap", gap: 2 }}>
              {hasMortalityRate && (
                <RadialGauge
                  value={data.mortalityRate!}
                  label="Taux mortalité"
                  color={data.mortalityRate! >= 5 ? colors.error.main : colors.warning.main}
                />
              )}
              {hasLayingRate && (
                <RadialGauge value={data.layingRate!} label="Taux de ponte" color={colors.primary[500]} />
              )}
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  );
}
