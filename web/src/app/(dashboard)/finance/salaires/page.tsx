"use client";

import { Box, Skeleton, Typography } from "@mui/material";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { SalariesView } from "@/components/finance/SalariesView";

/** Finance / Salaires page: resolves the active farm, then renders the salary manager. */
export default function SalariesPage() {
  const { farmId, isLoading } = useSelectedFarm();

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Salaires
      </Typography>

      {isLoading || !farmId ? (
        <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 2 }} />
      ) : (
        <SalariesView farmId={farmId} />
      )}
    </Box>
  );
}
