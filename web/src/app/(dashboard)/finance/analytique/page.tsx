"use client";

import { Box, Skeleton, Typography } from "@mui/material";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { FarmAnalyticsView } from "@/components/finance/FarmAnalyticsView";

/** Finance / Analytique : résout la ferme active puis affiche le compte de résultat ferme. */
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
        <FarmAnalyticsView farmId={farmId} />
      )}
    </Box>
  );
}
