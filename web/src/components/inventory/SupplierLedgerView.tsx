"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Trash2 } from "lucide-react";
import { useDeleteLedgerEntryMutation, useGetSupplierLedgerQuery } from "@/store/api/supplierLedgerApi";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { canManageCatalog, useFarmRole } from "@/hooks/useFarmRole";
import { useToast } from "@/components/feedback/ToastProvider";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SupplierPaymentDialog } from "./SupplierPaymentDialog";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency, formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { SupplierLedgerEntry } from "@/types";

/** Ce que dit un solde, en français plutôt qu'en signe. */
function balanceLabel(balanceXof: number): string {
  if (balanceXof > 0) return `Vous devez ${formatCurrency(balanceXof)}`;
  if (balanceXof < 0) return `Avance de ${formatCurrency(-balanceXof)}`;
  return "Compte soldé";
}

export function SupplierLedgerView({ supplierId }: { supplierId: number }) {
  const { farmId, hasFarm } = useSelectedFarm();
  const { data, isLoading } = useGetSupplierLedgerQuery(
    { farmId: farmId as number, supplierId },
    { skip: !hasFarm },
  );

  // Le backend réserve l'écriture au propriétaire et au gérant : on cache plutôt que de
  // proposer un geste qui répondra 403.
  const canWrite = canManageCatalog(useFarmRole(farmId));

  const [dialog, setDialog] = useState<"payment" | "charge" | null>(null);
  const [toRemove, setToRemove] = useState<SupplierLedgerEntry | null>(null);
  const [removeEntry, { isLoading: removing }] = useDeleteLedgerEntryMutation();
  const { showToast } = useToast();

  const confirmRemove = async () => {
    if (!toRemove || !farmId) return;
    try {
      await removeEntry({ farmId, supplierId, entryId: toRemove.id }).unwrap();
      setToRemove(null);
      showToast("Ligne supprimée.", "success");
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {isLoading ? "…" : balanceLabel(data?.balanceXof ?? 0)}
        </Typography>
        {canWrite && (
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={() => setDialog("payment")}>
              Enregistrer un paiement
            </Button>
            <Button variant="outlined" onClick={() => setDialog("charge")}>
              Ajouter une dette
            </Button>
          </Stack>
        )}
      </Stack>

      <Card>
        <CardContent>
          {!data?.entries.length ? (
            <Typography variant="body2" color="text.secondary">
              Aucun mouvement avec ce fournisseur.
            </Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Libellé</TableCell>
                    <TableCell align="right">Dette</TableCell>
                    <TableCell align="right">Payé</TableCell>
                    <TableCell align="right">Solde</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{formatDate(e.entryDate)}</TableCell>
                      <TableCell>{e.label ?? "—"}</TableCell>
                      <TableCell align="right">
                        {e.direction === "DEBIT" ? formatCurrency(e.amountXof) : ""}
                      </TableCell>
                      <TableCell align="right">
                        {e.direction === "CREDIT" ? formatCurrency(e.amountXof) : ""}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: "var(--font-mono)" }}>
                        {formatCurrency(e.runningBalanceXof)}
                      </TableCell>
                      <TableCell align="right">
                        {/* Une ligne dérivée d'un bon d'achat se corrige par son bon, pas ici. */}
                        {canWrite && e.source === "MANUAL" && (
                          <IconButton
                            size="small"
                            aria-label={`Supprimer la ligne du ${formatDate(e.entryDate)}`}
                            onClick={() => setToRemove(e)}
                            sx={{ color: colors.neutral[500] }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      <SupplierPaymentDialog
        open={dialog !== null}
        direction={dialog === "charge" ? "DEBIT" : "CREDIT"}
        supplierId={supplierId}
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={Boolean(toRemove)}
        title="Supprimer cette ligne ?"
        message="Elle disparaîtra du relevé et le solde sera recalculé."
        confirmLabel="Supprimer"
        danger
        loading={removing}
        onConfirm={confirmRemove}
        onClose={() => setToRemove(null)}
      />
    </Box>
  );
}
