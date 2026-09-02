"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { RotateCcw } from "lucide-react";
import { useGetUnitClosureQuery, useReopenUnitMutation } from "@/store/api/closureApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { useFarmRole, canManageCatalog } from "@/hooks/useFarmRole";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";

function Line({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <Stack
      direction="row"
      sx={{ justifyContent: "space-between", alignItems: "baseline", gap: 2 }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: strong ? 700 : 500,
          fontFamily: "var(--font-mono)",
          fontVariantNumeric: "tabular-nums",
          textAlign: "right",
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

const orDash = (v: number | null, render: (n: number) => string) =>
  v === null || v === undefined ? "—" : render(v);

/** The frozen end-of-cycle report of a closed batch, and the way back out of it. */
export function BatchClosureTab({
  farmId,
  unitId,
  batchName,
}: {
  farmId: number;
  unitId: number;
  batchName: string;
}) {
  const { data: closure, isLoading, error } = useGetUnitClosureQuery({ farmId, unitId });
  const [reopenUnit, { isLoading: isReopening }] = useReopenUnitMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { showToast } = useToast();
  const canReopen = canManageCatalog(useFarmRole(farmId));

  const onReopen = async () => {
    try {
      await reopenUnit({ farmId, unitId }).unwrap();
      showToast("Bande rouverte. Le bilan a été supprimé.", "success");
      setConfirmOpen(false);
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !closure) {
    return <Alert severity="info">Aucun bilan pour cette bande.</Alert>;
  }

  const unpricedArticles = closure.consumedArticles - closure.valuedArticles;

  return (
    <Stack spacing={3}>
      {closure.valuationIncomplete && (
        <Alert severity="warning">
          {unpricedArticles === 1
            ? "1 article consommé n'a pas de prix"
            : `${unpricedArticles} articles consommés n'ont pas de prix`}{" "}
          ({closure.valuedArticles}/{closure.consumedArticles} valorisés).{" "}
          <strong>Le coût réel est plus élevé que celui affiché.</strong> Renseignez le prix de
          ces articles dans les stocks, puis rouvrez et re-clôturez la bande pour un bilan juste.
        </Alert>
      )}

      <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ alignItems: "stretch" }}>
        <Card variant="outlined" sx={{ flex: 1, borderRadius: 3 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Technique
            </Typography>
            <Stack spacing={1.25} sx={{ mt: 1.5 }}>
              <Line label="Durée" value={`${closure.durationDays} jours`} />
              <Line label="Effectif initial" value={formatNumber(closure.initialCount)} />
              <Line label="Morts" value={formatNumber(closure.deaths)} />
              <Line
                label="Taux de mortalité"
                value={orDash(closure.mortalityPercent, (n) => `${n} %`)}
              />
              <Line label="Sujets restants" value={formatNumber(closure.remainingCount)} />
              <Divider sx={{ my: 0.5 }} />
              <Line
                label="Poids de sortie"
                value={orDash(closure.exitWeightG, (n) => `${formatNumber(n)} g`)}
              />
              <Line label="GMQ" value={orDash(closure.avgDailyGainG, (n) => `${n} g/j`)} />
              <Line
                label="Aliment consommé"
                value={orDash(closure.totalFeedKg, (n) => `${formatNumber(n)} kg`)}
              />
              <Line
                label="Indice de consommation"
                value={orDash(closure.feedConversionRatio, (n) => String(n))}
                strong
              />
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ flex: 1, borderRadius: 3 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Argent
            </Typography>
            <Stack spacing={1.25} sx={{ mt: 1.5 }}>
              <Line label="Recettes" value={formatCurrency(closure.revenueXof)} />
              <Divider sx={{ my: 0.5 }} />
              <Line label="Aliment et produits" value={formatCurrency(closure.feedCostXof)} />
              <Line label="Poussins" value={formatCurrency(closure.chickCostXof)} />
              <Line label="Autres dépenses" value={formatCurrency(closure.otherExpenseXof)} />
              <Line label="Coût total" value={formatCurrency(closure.totalCostXof)} strong />
              <Divider sx={{ my: 0.5 }} />
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "baseline", gap: 2 }}
              >
                <Typography variant="body2" color="text.secondary">
                  Marge
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    fontFamily: "var(--font-mono)",
                    fontVariantNumeric: "tabular-nums",
                    color:
                      closure.marginXof >= 0 ? colors.success.main : colors.error.main,
                  }}
                >
                  {formatCurrency(closure.marginXof)}
                </Typography>
              </Stack>
              <Line
                label="Coût de revient au kg vif"
                value={orDash(closure.costPerKgXof, (n) => formatCurrency(n))}
                strong
              />
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {closure.notes && (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Note
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
              {closure.notes}
            </Typography>
          </CardContent>
        </Card>
      )}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Typography variant="caption" color="text.secondary">
          Bilan figé le {formatDate(closure.closedAt)}. Les chiffres ne bougeront plus.
        </Typography>
        {canReopen && (
          <Button
            color="inherit"
            startIcon={<RotateCcw size={16} />}
            onClick={() => setConfirmOpen(true)}
          >
            Rouvrir la bande
          </Button>
        )}
      </Stack>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Rouvrir {batchName} ?</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning">
            Le bilan de cette bande sera <strong>supprimé</strong>. La bande redeviendra active
            et pourra à nouveau recevoir des saisies. Vous pourrez la clôturer de nouveau, ce
            qui recalculera un bilan avec les données du moment.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} color="inherit">
            Annuler
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={onReopen}
            disabled={isReopening}
            startIcon={isReopening ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Rouvrir
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
