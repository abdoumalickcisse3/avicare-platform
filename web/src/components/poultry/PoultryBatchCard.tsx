"use client";

import Link from "next/link";
import {
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { ArrowRight } from "lucide-react";
import { useGetPerformanceQuery } from "@/store/api/poultryBatchesApi";
import { formatNumber } from "@/lib/format";
import { ageInDays, batchProgress } from "@/lib/poultry";
import { colors } from "@/theme/tokens";
import { BatchStatusChip } from "./BatchStatusChip";
import { StatTile } from "./StatTile";
import type { PoultryBatch } from "@/types";

interface PoultryBatchCardProps {
  farmId: number;
  batch: PoultryBatch;
  breedName?: string;
}

const DASH = "—";

export function PoultryBatchCard({ farmId, batch, breedName }: PoultryBatchCardProps) {
  // Per-card snapshot (404 until the first weighing → KPIs show a dash).
  const { data: perf } = useGetPerformanceQuery(
    { farmId, batchId: batch.id },
    { skip: batch.status === "PLANNED" },
  );

  const age = ageInDays(batch.startDate);
  const progress = batchProgress(batch.startDate, batch.targetAgeDays);

  return (
    <Card sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <CardContent sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ justifyContent: "space-between", alignItems: "flex-start" }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {batch.name ?? `Lot #${batch.id}`}
            </Typography>
            {breedName && (
              <Typography variant="body2" color="text.secondary">
                {breedName}
              </Typography>
            )}
          </Box>
          <BatchStatusChip status={batch.status} />
        </Stack>

        <Box sx={{ mt: 2, mb: 2 }}>
          <Stack
            direction="row"
            sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              Progression cycle
            </Typography>
            <Typography
              variant="caption"
              sx={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}
            >
              Jour {age}/{batch.targetAgeDays ?? "?"}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1,
            mb: 2,
          }}
        >
          <StatTile label="Effectif" value={formatNumber(batch.currentCount)} unit="têtes" />
          <StatTile
            label="GMQ (ADG)"
            value={perf?.gmqGPerDay != null ? Math.round(perf.gmqGPerDay) : DASH}
            unit="g/j"
          />
          <StatTile
            label="Mortalité"
            value={
              perf?.cumulativeMortalityPercent != null
                ? `${perf.cumulativeMortalityPercent}%`
                : DASH
            }
            valueColor={colors.error.main}
          />
          <StatTile
            label="IC (FCR)"
            value={perf?.feedConversionRatio != null ? perf.feedConversionRatio : DASH}
          />
        </Box>

        <Button
          component={Link}
          href={`/elevage/lots/${batch.id}`}
          variant="outlined"
          fullWidth
          endIcon={<ArrowRight size={16} />}
          sx={{ mt: "auto" }}
        >
          Détails
        </Button>
      </CardContent>
    </Card>
  );
}
