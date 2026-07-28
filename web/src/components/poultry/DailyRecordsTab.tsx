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
import { DailyRecordDialog } from "./DailyRecordDialog";
import type { PoultryBatch } from "@/types";

const monoCell = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
} as const;

const DASH = "—";

export function DailyRecordsTab({
  farmId,
  batch,
}: {
  farmId: number;
  batch: PoultryBatch;
}) {
  const [open, setOpen] = useState(false);
  const { can } = useFarmPermissions(farmId);
  const canWrite = can("poultry:write");
  const { data: records, isLoading, error } = useGetDailyRecordsQuery({
    farmId,
    batchId: batch.id,
  });

  const sorted = [...(records ?? [])].sort((a, b) =>
    b.recordDate.localeCompare(a.recordDate),
  );
  const existingDates = (records ?? []).map((r) => r.recordDate);

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Saisies quotidiennes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Mortalité, aliment et eau au jour le jour.
          </Typography>
        </Box>
        {canWrite && (
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<Plus size={20} />}
            onClick={() => setOpen(true)}
            sx={{ fontWeight: 700, boxShadow: 3, flexShrink: 0 }}
          >
            Nouvelle saisie
          </Button>
        )}
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
            <ClipboardList size={40} />
          </Box>
          <Typography sx={{ fontWeight: 600 }}>Aucune saisie pour l&apos;instant</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
            Enregistrez la mortalité et la consommation du jour pour suivre les
            performances du lot.
          </Typography>
          {canWrite && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<Plus size={18} />}
              onClick={() => setOpen(true)}
              sx={{ mt: 1, fontWeight: 700 }}
            >
              Première saisie
            </Button>
          )}
        </Card>
      ) : (
        <TableContainer component={Card}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell align="right">Mortalité</TableCell>
                <TableCell align="right">Aliment (kg)</TableCell>
                <TableCell align="right">Eau (L)</TableCell>
                <TableCell>Observations</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={monoCell}>{formatDate(r.recordDate)}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      ...monoCell,
                      color: r.mortalityCount > 0 ? colors.error.main : "inherit",
                      fontWeight: r.mortalityCount > 0 ? 700 : 400,
                    }}
                  >
                    {r.mortalityCount}
                  </TableCell>
                  <TableCell align="right" sx={monoCell}>
                    {r.feedKg ? r.feedKg : DASH}
                  </TableCell>
                  <TableCell align="right" sx={monoCell}>
                    {r.waterL ? r.waterL : DASH}
                  </TableCell>
                  <TableCell sx={{ color: colors.neutral[500], maxWidth: 240 }}>
                    <Typography variant="body2" noWrap title={r.observations ?? ""}>
                      {r.observations || DASH}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <DailyRecordDialog
        open={open}
        onClose={() => setOpen(false)}
        farmId={farmId}
        batchId={batch.id}
        currentCount={batch.currentCount}
        existingDates={existingDates}
      />
    </Stack>
  );
}
