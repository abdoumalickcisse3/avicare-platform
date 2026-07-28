"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
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
import { ClipboardList, Plus } from "lucide-react";
import { useGetDailyRecordsQuery } from "@/store/api/poultryBatchesApi";
import { apiErrorMessage } from "@/lib/apiError";
import { formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import { useFarmPermissions } from "@/hooks/useFarmPermissions";
import { LayerDailyEntryDialog } from "./LayerDailyEntryDialog";
import type { ProductionUnit } from "@/types";

const monoCell = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;
const DASH = "—";

export function LayerDailyRecordsTab({
  farmId,
  unit,
}: {
  farmId: number;
  unit: ProductionUnit;
}) {
  const [open, setOpen] = useState(false);
  const { can } = useFarmPermissions(farmId);
  const canWrite = can("poultry:write");
  const { data: records, isLoading, error } = useGetDailyRecordsQuery({
    farmId,
    batchId: unit.id,
  });

  const sorted = [...(records ?? [])].sort((a, b) => b.recordDate.localeCompare(a.recordDate));
  const existingDates = (records ?? []).map((r) => r.recordDate);

  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Suivi journalier
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Aliment et eau distribués (mortalité dans l&apos;onglet Pondeuses).
          </Typography>
        </Box>
        {unit.status === "ACTIVE" && canWrite && (
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setOpen(true)}>
            Saisir
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error">{apiErrorMessage(error)}</Alert>}
      {isLoading && <Skeleton variant="rectangular" height={160} />}

      {!isLoading && sorted.length === 0 && (
        <Card sx={{ p: 4, textAlign: "center", color: colors.neutral[500] }}>
          <ClipboardList size={32} />
          <Typography sx={{ mt: 1 }}>Aucune saisie pour le moment.</Typography>
        </Card>
      )}

      {sorted.length > 0 && (
        <TableContainer component={Card}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell align="right">Aliment (kg)</TableCell>
                <TableCell align="right">Eau (L)</TableCell>
                <TableCell>Observations</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={monoCell}>{formatDate(r.recordDate)}</TableCell>
                  <TableCell align="right" sx={monoCell}>
                    {r.feedKg ?? DASH}
                  </TableCell>
                  <TableCell align="right" sx={monoCell}>
                    {r.waterL ?? DASH}
                  </TableCell>
                  <TableCell>{r.observations ?? DASH}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <LayerDailyEntryDialog
        open={open}
        onClose={() => setOpen(false)}
        farmId={farmId}
        unitId={unit.id}
        existingDates={existingDates}
      />
    </Stack>
  );
}
