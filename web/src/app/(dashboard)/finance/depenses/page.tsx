"use client";

import { Box, Skeleton, Typography } from "@mui/material";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { ExpensesView } from "@/components/finance/ExpensesView";

/** Finance / Dépenses page: resolves the active farm, then renders the expenses manager. */
export default function ExpensesPage() {
  const { farmId, isLoading } = useSelectedFarm();

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Dépenses
      </Typography>

      {isLoading || !farmId ? (
        <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 2 }} />
      ) : (
        <ExpensesView farmId={farmId} />
      )}
    </Box>
  );
}
