"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  MenuItem,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useGetCatalogQuery } from "@/store/api/catalogApi";
import { useGetProductionUnitsQuery } from "@/store/api/productionUnitsApi";
import {
  useDeleteExpenseMutation,
  useGetExpenseSummaryQuery,
  useGetExpensesQuery,
} from "@/store/api/financeApi";
import { useFarmRole, canManageCatalog } from "@/hooks/useFarmRole";
import { ExpenseDialog } from "./ExpenseDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency, formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { Expense, ExpenseSource } from "@/types";

const SOURCE_LABELS: Record<ExpenseSource, string> = {
  MANUAL: "Manuelle",
  PURCHASE: "Achat",
  STOCK_ENTRY: "Entrée stock",
  SALARY: "Salaire",
};

export function ExpensesView({ farmId }: { farmId: number }) {
  const [category, setCategory] = useState("");
  const {
    data: expenses,
    isLoading,
    error,
  } = useGetExpensesQuery({ farmId, category: category || undefined });
  const { data: summary } = useGetExpenseSummaryQuery({ farmId });
  const { data: categories = [] } = useGetCatalogQuery({ farmId, category: "expense_categories" });
  const { data: units = [] } = useGetProductionUnitsQuery({ farmId });
  const [deleteExpense, { isLoading: deleting }] = useDeleteExpenseMutation();
  const { showToast } = useToast();
  const role = useFarmRole(farmId);
  const canManage = canManageCatalog(role);

  const [addOpen, setAddOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [toRemove, setToRemove] = useState<Expense | null>(null);

  const categoryLabel = (key: string) =>
    String(categories.find((c) => c.key === key)?.value.label ?? key);
  const unitLabel = (unitId: number | null) => {
    if (unitId == null) return "—";
    const unit = units.find((u) => u.id === unitId);
    return unit ? (unit.name ?? `Lot #${unit.id}`) : `Lot #${unitId}`;
  };

  const handleRemove = async () => {
    if (!toRemove) return;
    try {
      await deleteExpense({ farmId, id: toRemove.id }).unwrap();
      showToast("Dépense supprimée.", "success");
      setToRemove(null);
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 2 }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Dépenses
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Charges d&apos;exploitation de la ferme.
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={() => setAddOpen(true)}
          >
            Ajouter
          </Button>
        )}
      </Stack>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="body2" color="text.secondary">
            Total de la période
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {formatCurrency(summary?.totalXof ?? 0)}
          </Typography>
        </CardContent>
      </Card>

      <TextField
        select
        label="Catégorie"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        sx={{ mb: 2, minWidth: 220 }}
        size="small"
      >
        <MenuItem value="">Toutes les catégories</MenuItem>
        {categories.map((c) => (
          <MenuItem key={c.key} value={c.key}>
            {String(c.value.label ?? c.key)}
          </MenuItem>
        ))}
      </TextField>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(error)}
        </Alert>
      )}

      {isLoading && <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />}

      {!isLoading && !error && expenses && expenses.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          Aucune dépense. Ajoutez la première.
        </Typography>
      )}

      {!isLoading && !error && expenses && expenses.length > 0 && (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Libellé</TableCell>
                <TableCell>Catégorie</TableCell>
                <TableCell>Lot</TableCell>
                <TableCell align="right">Montant</TableCell>
                <TableCell>Origine</TableCell>
                {canManage && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.map((exp) => {
                const editable = exp.source === "MANUAL" && canManage;
                return (
                  <TableRow key={exp.id} hover>
                    <TableCell>{formatDate(exp.expenseDate)}</TableCell>
                    <TableCell>{exp.label}</TableCell>
                    <TableCell>{categoryLabel(exp.categoryKey)}</TableCell>
                    <TableCell>{unitLabel(exp.productionUnitId)}</TableCell>
                    <TableCell align="right">{formatCurrency(exp.amountXof)}</TableCell>
                    <TableCell>
                      <Chip
                        label={SOURCE_LABELS[exp.source]}
                        size="small"
                        sx={{
                          bgcolor: exp.source === "MANUAL" ? colors.accent[50] : colors.primary[50],
                          color: exp.source === "MANUAL" ? colors.accent[700] : colors.primary[700],
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    {canManage && (
                      <TableCell align="right">
                        {editable && (
                          <>
                            <IconButton
                              aria-label={`Modifier ${exp.label}`}
                              onClick={() => setEditExpense(exp)}
                              size="small"
                            >
                              <Pencil size={18} />
                            </IconButton>
                            <IconButton
                              aria-label={`Supprimer ${exp.label}`}
                              onClick={() => setToRemove(exp)}
                              size="small"
                            >
                              <Trash2 size={18} />
                            </IconButton>
                          </>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {canManage && (
        <ExpenseDialog open={addOpen} onClose={() => setAddOpen(false)} farmId={farmId} />
      )}
      {canManage && editExpense && (
        <ExpenseDialog
          open
          onClose={() => setEditExpense(null)}
          farmId={farmId}
          expense={editExpense}
        />
      )}
      <ConfirmDialog
        open={Boolean(toRemove)}
        title="Supprimer cette dépense ?"
        message="Cette dépense manuelle sera définitivement supprimée."
        confirmLabel="Supprimer"
        danger
        loading={deleting}
        onConfirm={handleRemove}
        onClose={() => setToRemove(null)}
      />
    </Box>
  );
}
