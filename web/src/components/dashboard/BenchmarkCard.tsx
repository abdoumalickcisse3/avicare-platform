"use client";

import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { Users } from "lucide-react";
import { useGetBenchmarkComparisonQuery } from "@/store/api/benchmarksApi";

function rate(value: string | null): string {
  return value === null ? "—" : `${value} %`;
}

/**
 * Where this farm sits against the others, anonymously.
 *
 * Renders nothing at all when the platform has comparison off — an empty card explaining an
 * absent feature is noise on a screen a farmer opens every morning. When it is on but the cohort
 * is too small, the reason is shown: that is a rule worth understanding, not a failure.
 */
export function BenchmarkCard({ farmId }: { farmId: number }) {
  const { data } = useGetBenchmarkComparisonQuery({ farmId });

  if (!data) return null;
  if (!data.available) {
    // Off entirely: say nothing. Cohort too small: explain, because it will resolve on its own.
    if (!data.unavailableReason?.includes("fermes comparables")) return null;
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            {data.unavailableReason}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const mine = data.farmMortalityRate;
  const platform = data.platformMortalityRate;
  const better = mine !== null && platform !== null && Number(mine) < Number(platform);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5 }}>
          <Users size={18} />
          <Typography variant="subtitle2">Votre mortalité, comparée</Typography>
          <Chip size="small" variant="outlined" label={`${data.cohortSize} fermes`} />
        </Stack>
        <Stack direction="row" sx={{ gap: 4, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {rate(mine)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              votre ferme
            </Typography>
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "text.secondary" }}>
              {rate(platform)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              moyenne des fermes
            </Typography>
          </Box>
        </Stack>
        {mine !== null && platform !== null && (
          <Typography variant="caption" color={better ? "success.main" : "warning.main"}>
            {better
              ? "Vous perdez moins d'animaux que la moyenne."
              : "Vous perdez plus d'animaux que la moyenne."}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Moyenne calculée par ferme, sur les fermes comparables. Aucune ferme n&apos;est nommée.
        </Typography>
      </CardContent>
    </Card>
  );
}
