"use client";

import Link from "next/link";
import { Box, Card, CardActionArea, Stack, Typography } from "@mui/material";
import { Egg, Percent } from "lucide-react";
import {
  useGetCollectionsQuery,
  useGetRollingRateQuery,
} from "@/store/api/eggProductionApi";
import { ageInDays } from "@/lib/poultry";
import { formatNumber } from "@/lib/format";
import { isoToday } from "@/lib/layer";
import { colors } from "@/theme/tokens";
import { BatchStatusChip } from "@/components/poultry/BatchStatusChip";
import { StatTile } from "@/components/poultry/StatTile";
import type { ProductionUnit } from "@/types";

const DASH = "—";

export function LayerUnitSummaryCard({
  farmId,
  unit,
  breedName,
}: {
  farmId: number;
  unit: ProductionUnit;
  breedName?: string;
}) {
  const today = isoToday();
  const { data: todayCollections } = useGetCollectionsQuery({
    farmId,
    unitId: unit.id,
    from: today,
    to: today,
  });
  const { data: rolling } = useGetRollingRateQuery({ farmId, unitId: unit.id, days: 7 });

  const todayEggs = (todayCollections ?? []).reduce((s, c) => s + c.totalEggs, 0);
  const avgRate = rolling?.avgLayingRatePct;
  const title = unit.name || `${breedName ?? "Lot"} #${unit.id}`;
  const week = Math.floor(ageInDays(unit.startDate) / 7) + 1;

  return (
    <Card>
      <CardActionArea component={Link} href={`/elevage/oeufs/${unit.id}`} sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {breedName ?? "Souche inconnue"} · Semaine {week}
              </Typography>
            </Box>
            <BatchStatusChip status={unit.status} />
          </Stack>

          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: "1fr 1fr 1fr",
            }}
          >
            <StatTile label="Effectif" value={formatNumber(unit.currentCount)} />
            <StatTile
              label="Œufs / jour"
              value={
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  <Egg size={14} color={colors.primary[500]} />
                  <span>{formatNumber(todayEggs)}</span>
                </Stack>
              }
            />
            <StatTile
              label="Ponte 7j"
              value={
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  <Percent size={14} color={colors.success.main} />
                  <span>{avgRate != null ? Number(avgRate).toFixed(0) : DASH}</span>
                </Stack>
              }
            />
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
