"use client";

import { Box, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import { useGetUnitEventsQuery } from "@/store/api/productionUnitsApi";
import {
  useGetCollectionsQuery,
  useGetDailyProductionsQuery,
} from "@/store/api/eggProductionApi";
import { deriveLayingOnset } from "@/lib/flock";
import { isoDaysAgo, isoToday } from "@/lib/layer";
import type { ProductionUnit } from "@/types";
import { FlockCountCurve } from "./charts/FlockCountCurve";
import { FlockAttritionPanel } from "./FlockAttritionPanel";
import { BandEventList } from "./BandEventList";
import { TrayStockPanel } from "./TrayStockPanel";

export function LayerFlockTab({
  farmId,
  unit,
}: {
  farmId: number;
  unit: ProductionUnit;
}) {
  const { data: events, isLoading } = useGetUnitEventsQuery({
    farmId,
    unitId: unit.id,
  });
  const { data: productions } = useGetDailyProductionsQuery({
    farmId,
    unitId: unit.id,
    from: isoDaysAgo(365),
    to: isoToday(),
  });
  const { data: collections } = useGetCollectionsQuery({
    farmId,
    unitId: unit.id,
    from: isoDaysAgo(365),
    to: isoToday(),
  });

  const evts = events ?? [];
  const onset = deriveLayingOnset(productions ?? [], collections ?? []);

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Effectif de la bande
            </Typography>
            {isLoading ? (
              <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />
            ) : (
              <FlockCountCurve events={evts} />
            )}
          </CardContent>
        </Card>

        <FlockAttritionPanel
          farmId={farmId}
          unitId={unit.id}
          status={unit.status}
          currentCount={unit.currentCount}
          events={evts}
          onsetDate={onset}
        />
      </Box>

      <TrayStockPanel farmId={farmId} />

      <BandEventList events={evts} />
    </Stack>
  );
}
