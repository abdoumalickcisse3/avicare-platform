"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  MenuItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useGetProductionUnitsQuery } from "@/store/api/productionUnitsApi";
import { useGetUnitAnalyticsQuery } from "@/store/api/financeApi";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/format";
import { colors } from "@/theme/tokens";

/**
 * Per-lot cost/revenue/margin analytics: a unit selector (defaulting to the
 * first unit) driving three KPI cards and a per-category cost breakdown.
 */
export function UnitAnalyticsView({ farmId }: { farmId: number }) {
  const { data: units = [], isLoading: unitsLoading } = useGetProductionUnitsQuery({ farmId });
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  // Default to the first unit until the user picks another one explicitly.
  const unitId = selectedUnitId ?? units[0]?.id ?? null;

  const {
    data: analytics,
    isLoading: analyticsLoading,
    error,
  } = useGetUnitAnalyticsQuery({ farmId, unitId: unitId ?? 0 }, { skip: unitId === null });

  if (unitsLoading) {
    return <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />;
  }

  if (units.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
        Aucun lot. Créez un lot pour consulter son analytique.
      </Typography>
    );
  }

  return (
    <Box>
      <TextField
        select
        label="Lot"
        value={unitId ?? ""}
        onChange={(e) => setSelectedUnitId(Number(e.target.value))}
        sx={{ mb: 3, minWidth: 260 }}
        size="small"
      >
        {units.map((u) => (
          <MenuItem key={u.id} value={u.id}>
            {u.name ?? `Lot #${u.id}`}
          </MenuItem>
        ))}
      </TextField>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(error)}
        </Alert>
      )}

      {analyticsLoading && <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />}

      {!analyticsLoading && !error && analytics && (
        <>
          <Box
            sx={{
              display: "grid",
              gap: { xs: 2, md: 3 },
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
              mb: 3,
            }}
          >
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Coût total
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {formatCurrency(analytics.totalCostXof)}
                </Typography>
                {analytics.costPerHeadXof != null && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                    Coût par tête : {formatCurrency(analytics.costPerHeadXof)}
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Revenus
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {formatCurrency(analytics.revenueXof)}
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Marge
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    color: analytics.marginXof >= 0 ? colors.success.main : colors.error.main,
                  }}
                >
                  {formatCurrency(analytics.marginXof)}
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {analytics.costs.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
              Aucun coût enregistré pour ce lot.
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Catégorie</TableCell>
                    <TableCell align="right">Montant</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analytics.costs.map((c) => (
                    <TableRow key={c.categoryKey} hover>
                      <TableCell>{c.label}</TableCell>
                      <TableCell align="right">{formatCurrency(c.amountXof)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Box>
  );
}
