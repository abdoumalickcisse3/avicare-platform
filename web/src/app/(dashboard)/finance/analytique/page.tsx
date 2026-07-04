"use client";

import { Box, Skeleton, Typography } from "@mui/material";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { UnitAnalyticsView } from "@/components/finance/UnitAnalyticsView";

/** Finance / Analytique page: resolves the active farm, then renders the per-lot analytics. */
export default function AnalyticsPage() {
  const { farmId, isLoading } = useSelectedFarm();

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Analytique
      </Typography>

      {isLoading || !farmId ? (
        <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 2 }} />
      ) : (
        <UnitAnalyticsView farmId={farmId} />
      )}
    </Box>
  );
}
