"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { Plus, Scale } from "lucide-react";
import { useGetWeighingsQuery } from "@/store/api/poultryBatchesApi";
import { apiErrorMessage } from "@/lib/apiError";
import { formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import { WeighingDialog } from "./WeighingDialog";
import type { PoultryBatch, WeighingSample } from "@/types";

const monoSx = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
} as const;

const DASH = "—";

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {label}
      </Typography>
      <Typography sx={{ ...monoSx, fontSize: "1.1rem", color: colors.neutral[800] }}>
        {value}
        {unit && (
          <Box component="span" sx={{ fontSize: "0.7rem", ml: 0.25, color: colors.neutral[500] }}>
            {unit}
          </Box>
        )}
      </Typography>
    </Box>
  );
}

function WeighingCard({ w }: { w: WeighingSample }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.5 }}
        >
          <Typography sx={{ fontWeight: 600 }}>{formatDate(w.sampleDate)}</Typography>
          <Box
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 999,
              bgcolor: colors.primary[50],
              color: colors.primary[700],
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            Jour {w.ageDays} · {w.sampleSize} sujets
          </Box>
        </Stack>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "repeat(3, 1fr)", sm: "repeat(5, 1fr)" },
          }}
        >
          <Metric label="Moyenne" value={String(Math.round(w.avgWeightG))} unit="g" />
          <Metric label="Min" value={w.minWeightG != null ? String(w.minWeightG) : DASH} unit="g" />
          <Metric label="Max" value={w.maxWeightG != null ? String(w.maxWeightG) : DASH} unit="g" />
          <Metric
            label="Écart-type"
            value={w.stdDeviation != null ? w.stdDeviation.toFixed(1) : DASH}
            unit="g"
          />
          <Metric
            label="Uniformité"
            value={w.uniformityPercent != null ? String(Math.round(w.uniformityPercent)) : DASH}
            unit="%"
          />
        </Box>
        {w.notes && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {w.notes}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export function WeighingsTab({
  farmId,
  batch,
}: {
  farmId: number;
  batch: PoultryBatch;
}) {
  const [open, setOpen] = useState(false);
  const { data: weighings, isLoading, error } = useGetWeighingsQuery({
    farmId,
    batchId: batch.id,
  });

  const sorted = [...(weighings ?? [])].sort((a, b) =>
    b.sampleDate.localeCompare(a.sampleDate),
  );

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Pesées
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Suivi du poids moyen et de l&apos;uniformité du lot.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<Plus size={20} />}
          onClick={() => setOpen(true)}
          sx={{ fontWeight: 700, boxShadow: 3, flexShrink: 0 }}
        >
          Nouvelle pesée
        </Button>
      </Stack>

      {error ? (
        <Alert severity="error">{apiErrorMessage(error)}</Alert>
      ) : isLoading ? (
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2 }} />
      ) : sorted.length === 0 ? (
        <Card
          sx={{
            py: 6,
            px: 3,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <Box sx={{ color: colors.neutral[400] }}>
            <Scale size={40} />
          </Box>
          <Typography sx={{ fontWeight: 600 }}>Aucune pesée enregistrée</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
            Pesez un échantillon de sujets pour suivre la croissance réelle face à
            l&apos;objectif de la souche.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={() => setOpen(true)}
            sx={{ mt: 1, fontWeight: 700 }}
          >
            Première pesée
          </Button>
        </Card>
      ) : (
        <Stack spacing={2}>
          {sorted.map((w) => (
            <WeighingCard key={w.id} w={w} />
          ))}
        </Stack>
      )}

      <WeighingDialog
        open={open}
        onClose={() => setOpen(false)}
        farmId={farmId}
        batchId={batch.id}
      />
    </Stack>
  );
}
