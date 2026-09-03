"use client";

import { Box, Skeleton, Typography } from "@mui/material";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { ClosedBatchesTable } from "@/components/poultry/ClosedBatchesTable";

/** Élevage / Bilans : les bandes clôturées, côte à côte. */
export default function ClosedBatchesPage() {
  const { farmId, isLoading } = useSelectedFarm();

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        Bilans de bande
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Chaque cycle terminé, figé au moment de sa clôture. Triez sur la colonne qui vous
        intéresse.
      </Typography>

      {isLoading || !farmId ? (
        <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />
      ) : (
        <ClosedBatchesTable farmId={farmId} />
      )}
    </Box>
  );
}
