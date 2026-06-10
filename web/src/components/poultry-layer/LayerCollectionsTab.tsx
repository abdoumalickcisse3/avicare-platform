"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Egg, Plus, Trash2 } from "lucide-react";
import {
  useDeleteCollectionMutation,
  useGetCollectionsQuery,
  useGetGradesQuery,
  useGetTimeslotsQuery,
} from "@/store/api/eggProductionApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { isFeatureForbidden } from "@/lib/poultry";
import { formatDate } from "@/lib/format";
import { isoDaysAgo, isoToday, sortGradeKeys, timeslotLabel } from "@/lib/layer";
import { colors } from "@/theme/tokens";
import { EggCollectionDialog } from "./EggCollectionDialog";
import type { ProductionUnit } from "@/types";

const monoCell = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
} as const;

const DASH = "—";

function gradesSummary(grades: Record<string, number>): string {
  const keys = sortGradeKeys(Object.keys(grades)).filter((k) => grades[k] > 0);
  if (keys.length === 0) return DASH;
  return keys.map((k) => `${k}:${grades[k]}`).join(" · ");
}

export function LayerCollectionsTab({
  farmId,
  unit,
}: {
  farmId: number;
  unit: ProductionUnit;
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const { data: collections, isLoading, error } = useGetCollectionsQuery({
    farmId,
    unitId: unit.id,
    from: isoDaysAgo(30),
    to: isoToday(),
  });
  const { data: timeslotEntries } = useGetTimeslotsQuery({ farmId });
  const { data: gradeEntries } = useGetGradesQuery({ farmId });
  const [deleteCollection] = useDeleteCollectionMutation();

  const timeslots = (timeslotEntries ?? []).map((e) => e.key);
  const grades = (gradeEntries ?? []).map((e) => e.key);

  const sorted = [...(collections ?? [])].sort((a, b) => {
    const byDate = b.collectionDate.localeCompare(a.collectionDate);
    return byDate !== 0 ? byDate : a.timeslotKey.localeCompare(b.timeslotKey);
  });
  const existingKeys = (collections ?? []).map(
    (c) => `${c.collectionDate}|${c.timeslotKey}`,
  );

  const onDelete = async (id: number) => {
    try {
      await deleteCollection({ farmId, id, unitId: unit.id }).unwrap();
      showToast("Collecte supprimée.", "success");
    } catch (err) {
      showToast(
        isFeatureForbidden(err)
          ? "Suppression réservée aux gérants et propriétaires."
          : apiErrorMessage(err),
        "error",
      );
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Collectes (30 derniers jours)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Une ligne par créneau de ramassage.
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
          Saisir collecte
        </Button>
      </Stack>

      {error ? (
        <Alert severity="error">{apiErrorMessage(error)}</Alert>
      ) : isLoading ? (
        <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 2 }} />
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
            <Egg size={40} />
          </Box>
          <Typography sx={{ fontWeight: 600 }}>Aucune collecte enregistrée</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
            Saisissez la première collecte du jour pour suivre la production.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={() => setOpen(true)}
            sx={{ mt: 1, fontWeight: 700 }}
          >
            Première collecte
          </Button>
        </Card>
      ) : (
        <TableContainer component={Card}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Créneau</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Cassés</TableCell>
                <TableCell>Calibres</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell sx={monoCell}>{formatDate(c.collectionDate)}</TableCell>
                  <TableCell>{timeslotLabel(c.timeslotKey)}</TableCell>
                  <TableCell align="right" sx={{ ...monoCell, fontWeight: 700 }}>
                    {c.totalEggs}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      ...monoCell,
                      color: c.brokenEggs > 0 ? colors.error.main : "inherit",
                    }}
                  >
                    {c.brokenEggs}
                  </TableCell>
                  <TableCell sx={{ color: colors.neutral[600], ...monoCell }}>
                    {gradesSummary(c.gradesCount ?? {})}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      aria-label="Supprimer la collecte"
                      onClick={() => onDelete(c.id)}
                      sx={{ color: colors.neutral[400] }}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <EggCollectionDialog
        open={open}
        onClose={() => setOpen(false)}
        farmId={farmId}
        unitId={unit.id}
        unitName={unit.name ?? `Lot #${unit.id}`}
        timeslots={timeslots}
        grades={grades}
        existingKeys={existingKeys}
      />
    </Stack>
  );
}
