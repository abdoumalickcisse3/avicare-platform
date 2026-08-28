"use client";

import Link from "next/link";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Download } from "lucide-react";
import { useGetFarmsAtRiskQuery } from "@/store/api/adminApi";
import { downloadCsv, toCsv } from "@/lib/csv";
import { colors } from "@/theme/tokens";
import type { FarmHealthRow } from "@/types";

const LEVEL: Record<FarmHealthRow["level"], { label: string; color: "warning" | "error" | "success" }> = {
  OK: { label: "À jour", color: "success" },
  WATCH: { label: "À surveiller", color: "warning" },
  AT_RISK: { label: "À risque", color: "error" },
};

function exportRows(rows: FarmHealthRow[]): void {
  const csv = toCsv(
    ["Ferme", "Niveau", "Jours sans saisie", "Raison"],
    rows.map((r) => [r.name, LEVEL[r.level].label, r.daysSinceLastEntry, r.reason]),
  );
  downloadCsv(`fermes-a-relancer-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

/** Anti-churn list: the farms worth a call, with the reason to give when calling. */
export function FarmsAtRisk() {
  const { data: rows = [], isLoading } = useGetFarmsAtRiskQuery();

  return (
    <Card>
      <CardContent>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", mb: 2, gap: 2, flexWrap: "wrap" }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Fermes à relancer {rows.length > 0 && `(${rows.length})`}
          </Typography>
          {rows.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Download size={16} />}
              onClick={() => exportRows(rows)}
            >
              Exporter (CSV)
            </Button>
          )}
        </Stack>

        {!isLoading && rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            Aucune ferme ne décroche. Toutes ont saisi récemment.
          </Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Ferme</TableCell>
                  <TableCell>Niveau</TableCell>
                  <TableCell align="right">Jours</TableCell>
                  <TableCell>Raison</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.farmId} hover>
                    <TableCell>
                      <Typography
                        component={Link}
                        href={`/console/fermes/${r.farmId}`}
                        variant="body2"
                        sx={{ fontWeight: 600, color: colors.primary[600] }}
                      >
                        {r.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={LEVEL[r.level].color} label={LEVEL[r.level].label} />
                    </TableCell>
                    {/* A farm that never started has no day count to show. */}
                    <TableCell align="right">{r.daysSinceLastEntry ?? "—"}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {r.reason}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
