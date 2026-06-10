"use client";

import { useMemo } from "react";
import { Box, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import { Egg, HeartCrack, Percent, Bird } from "lucide-react";
import {
  useGetCollectionsQuery,
  useGetDailyProductionsQuery,
  useGetRollingRateQuery,
} from "@/store/api/eggProductionApi";
import { formatNumber } from "@/lib/format";
import { isoDaysAgo, isoToday } from "@/lib/layer";
import { colors } from "@/theme/tokens";
import { LayerKpiCard } from "./LayerKpiCard";
import { LayingRateCurve } from "./charts/LayingRateCurve";
import { Production7dChart } from "./charts/Production7dChart";
import { GradesDistributionChart } from "./charts/GradesDistributionChart";
import type { ProductionUnit } from "@/types";

const DASH = "—";

export function LayerOverviewTab({
  farmId,
  unit,
}: {
  farmId: number;
  unit: ProductionUnit;
}) {
  const today = isoToday();
  const { data: todayCollections, isLoading: cLoading } = useGetCollectionsQuery({
    farmId,
    unitId: unit.id,
    from: today,
    to: today,
  });
  const { data: productions, isLoading: pLoading } = useGetDailyProductionsQuery({
    farmId,
    unitId: unit.id,
    from: isoDaysAgo(30),
    to: today,
  });
  const { data: rolling } = useGetRollingRateQuery({ farmId, unitId: unit.id, days: 7 });

  const todayTotals = useMemo(() => {
    const list = todayCollections ?? [];
    const grades: Record<string, number> = {};
    let total = 0;
    let broken = 0;
    for (const c of list) {
      total += c.totalEggs;
      broken += c.brokenEggs;
      for (const [k, v] of Object.entries(c.gradesCount ?? {})) {
        grades[k] = (grades[k] ?? 0) + v;
      }
    }
    return { total, broken, grades };
  }, [todayCollections]);

  const avgRate = rolling?.avgLayingRatePct;

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" },
        }}
      >
        <LayerKpiCard
          label="Œufs aujourd'hui"
          value={cLoading ? DASH : formatNumber(todayTotals.total)}
          unit="œufs"
          icon={<Egg size={20} />}
          tint={colors.primary[500]}
        />
        <LayerKpiCard
          label="Cassés aujourd'hui"
          value={cLoading ? DASH : formatNumber(todayTotals.broken)}
          unit="œufs"
          icon={<HeartCrack size={20} />}
          tint={colors.error.main}
        />
        <LayerKpiCard
          label="Taux de ponte (7j)"
          value={avgRate != null ? Number(avgRate).toFixed(1) : DASH}
          unit="%"
          icon={<Percent size={20} />}
          tint={colors.success.main}
        />
        <LayerKpiCard
          label="Effectif pondeuses"
          value={formatNumber(unit.currentCount)}
          unit="sujets"
          icon={<Bird size={20} />}
          tint={colors.info.main}
        />
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Courbe de taux de ponte
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Taux réel par journée clôturée vs cible de pic de ponte.
          </Typography>
          {pLoading ? (
            <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />
          ) : (
            <LayingRateCurve productions={productions ?? []} />
          )}
        </CardContent>
      </Card>

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
              Collectes (7 jours)
            </Typography>
            {pLoading ? (
              <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
            ) : (
              <Production7dChart productions={productions ?? []} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Répartition par calibre (aujourd&apos;hui)
            </Typography>
            {cLoading ? (
              <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
            ) : (
              <GradesDistributionChart gradesCount={todayTotals.grades} />
            )}
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
