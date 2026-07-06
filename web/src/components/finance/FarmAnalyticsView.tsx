"use client";

import {
  Alert,
  Box,
  Card,
  CardContent,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useGetFarmAnalyticsQuery } from "@/store/api/financeApi";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/format";
import { colors } from "@/theme/tokens";

/**
 * Compte de résultat ferme : trois KPIs (total revenus, total dépenses, marge colorée), le détail
 * du revenu (ventes directes + commandes payées), la ventilation des dépenses par catégorie et le
 * revenu par lot. Totaux cumulés.
 */
export function FarmAnalyticsView({ farmId }: { farmId: number }) {
  const { data, isLoading, error } = useGetFarmAnalyticsQuery({ farmId });

  if (isLoading) {
    return <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />;
  }
  if (error) {
    return <Alert severity="error">{apiErrorMessage(error)}</Alert>;
  }
  if (!data) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
        Aucune donnée financière pour le moment.
      </Typography>
    );
  }

  const empty = data.totalRevenueXof === 0 && data.totalExpenseXof === 0;

  return (
    <Box>
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
              Total revenus
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {formatCurrency(data.totalRevenueXof)}
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Total dépenses
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {formatCurrency(data.totalExpenseXof)}
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
                color: data.marginXof >= 0 ? colors.success.main : colors.error.main,
              }}
            >
              {formatCurrency(data.marginXof)}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Détail du revenu
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
            <Typography variant="body2">Ventes directes</Typography>
            <Typography variant="body2">{formatCurrency(data.directSalesXof)}</Typography>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
            <Typography variant="body2">Commandes payées</Typography>
            <Typography variant="body2">{formatCurrency(data.paidOrdersXof)}</Typography>
          </Box>
        </CardContent>
      </Card>

      {empty ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
          Aucune donnée financière pour le moment.
        </Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Dépenses par catégorie
            </Typography>
            {data.expensesByCategory.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Aucune dépense.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Catégorie</TableCell>
                      <TableCell align="right">Montant</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.expensesByCategory.map((c) => (
                      <TableRow key={c.categoryKey} hover>
                        <TableCell>{c.label}</TableCell>
                        <TableCell align="right">{formatCurrency(c.amountXof)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Revenu par lot
            </Typography>
            {data.revenueByUnit.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Aucune vente attribuée à un lot.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Lot</TableCell>
                      <TableCell align="right">Revenu</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.revenueByUnit.map((u) => (
                      <TableRow key={u.unitId} hover>
                        <TableCell>{u.unitName}</TableCell>
                        <TableCell align="right">{formatCurrency(u.revenueXof)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
