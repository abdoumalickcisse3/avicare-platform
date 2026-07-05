"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
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
import { useGetAdvancesQuery, useApproveAdvanceMutation, useRejectAdvanceMutation } from "@/store/api/financeApi";
import { useGetMembersQuery } from "@/store/api/membersApi";
import { useFarmRole, canManageCatalog } from "@/hooks/useFarmRole";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency, formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { Advance, AdvanceStatus } from "@/types";

const STATUS_META: Record<AdvanceStatus, { label: string; bg: string; color: string }> = {
  PENDING: { label: "En attente", bg: colors.warning.light, color: colors.warning.dark },
  APPROVED: { label: "Approuvée", bg: colors.success.light, color: colors.success.dark },
  REJECTED: { label: "Rejetée", bg: colors.error.light, color: colors.error.dark },
};

export function AdvancesPanel({ farmId }: { farmId: number }) {
  const { data: advances, isLoading, error } = useGetAdvancesQuery({ farmId });
  const { data: members = [] } = useGetMembersQuery(farmId);
  const [approveAdvance, { isLoading: approving }] = useApproveAdvanceMutation();
  const [rejectAdvance, { isLoading: rejecting }] = useRejectAdvanceMutation();
  const { showToast } = useToast();
  const role = useFarmRole(farmId);
  const canManage = canManageCatalog(role);

  const [toApprove, setToApprove] = useState<Advance | null>(null);
  const [toReject, setToReject] = useState<Advance | null>(null);

  const memberName = (userId: number) => members.find((m) => m.userId === userId)?.fullName ?? `#${userId}`;

  const handleApprove = async () => {
    if (!toApprove) return;
    try {
      await approveAdvance({ farmId, id: toApprove.id }).unwrap();
      showToast("Avance approuvée.", "success");
      setToApprove(null);
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const handleReject = async () => {
    if (!toReject) return;
    try {
      await rejectAdvance({ farmId, id: toReject.id }).unwrap();
      showToast("Avance rejetée.", "success");
      setToReject(null);
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Avances sur salaire
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(error)}
        </Alert>
      )}

      {isLoading && <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2 }} />}

      {!isLoading && !error && advances && advances.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
          Aucune demande d&apos;avance.
        </Typography>
      )}

      {!isLoading && !error && advances && advances.length > 0 && (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Membre</TableCell>
                <TableCell align="right">Montant</TableCell>
                <TableCell>Motif</TableCell>
                <TableCell>Demandée le</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell align="right">Restant</TableCell>
                {canManage && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {advances.map((adv) => {
                const meta = STATUS_META[adv.status];
                return (
                  <TableRow key={adv.id} hover>
                    <TableCell>{memberName(adv.userId)}</TableCell>
                    <TableCell align="right">{formatCurrency(adv.amountXof)}</TableCell>
                    <TableCell>{adv.reason ?? "—"}</TableCell>
                    <TableCell>{formatDate(adv.requestedAt)}</TableCell>
                    <TableCell>
                      <Chip
                        label={meta.label}
                        size="small"
                        sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {adv.status === "APPROVED" ? formatCurrency(adv.remainingXof) : "—"}
                    </TableCell>
                    {canManage && (
                      <TableCell align="right">
                        {adv.status === "PENDING" && (
                          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                            <Button size="small" variant="outlined" onClick={() => setToApprove(adv)}>
                              Approuver
                            </Button>
                            <Button size="small" variant="outlined" color="error" onClick={() => setToReject(adv)}>
                              Rejeter
                            </Button>
                          </Stack>
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

      <ConfirmDialog
        open={Boolean(toApprove)}
        title="Approuver cette avance ?"
        message={
          toApprove
            ? `L'avance de ${formatCurrency(toApprove.amountXof)} pour ${memberName(toApprove.userId)} sera approuvée.`
            : ""
        }
        confirmLabel="Confirmer"
        loading={approving}
        onConfirm={handleApprove}
        onClose={() => setToApprove(null)}
      />
      <ConfirmDialog
        open={Boolean(toReject)}
        title="Rejeter cette avance ?"
        message={
          toReject
            ? `L'avance de ${formatCurrency(toReject.amountXof)} pour ${memberName(toReject.userId)} sera rejetée.`
            : ""
        }
        confirmLabel="Confirmer"
        danger
        loading={rejecting}
        onConfirm={handleReject}
        onClose={() => setToReject(null)}
      />
    </Box>
  );
}
