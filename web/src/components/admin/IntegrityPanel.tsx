"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Calculator, CheckCheck, HandHelping, Play, ShieldCheck } from "lucide-react";
import {
  useAcceptDriftMutation,
  useApplyRecomputeMutation,
  useGetIntegritySummaryQuery,
  useLazyPreviewRecomputeQuery,
  useMarkManuallyFixedMutation,
  useRunIntegrityChecksMutation,
} from "@/store/api/adminApi";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/feedback/ToastProvider";
import { colors } from "@/theme/tokens";
import type { FindingRow, RecomputeResult } from "@/types";

const SEVERITY_COLOR: Record<FindingRow["severity"], string> = {
  CRITICAL: "#b3261e",
  WARNING: "#b26a00",
  INFO: colors.neutral[600],
};

type Action = "recompute" | "accept" | "manual";

const ACTION_TITLE: Record<Action, string> = {
  recompute: "Recalculer la valeur",
  accept: "Accepter l'écart",
  manual: "Marquer comme corrigé à la main",
};

const ACTION_EXPLANATION: Record<Action, string> = {
  recompute:
    "La valeur dérivée sera réécrite à partir des enregistrements sources. Rien d'autre n'est touché.",
  accept: "L'anomalie est réelle mais assumée. Elle sera close sans rien modifier.",
  manual: "La correction a été faite dans l'application. L'anomalie sera close sans rien modifier.",
};

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 130 }}>
      <CardContent>
        <Typography variant="h4" sx={{ fontWeight: 800, color: value > 0 ? color : colors.neutral[400] }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

/**
 * The integrity screen.
 *
 * <p>Ordered by how much it matters, not by how recent it is: money that does not add up sits at the
 * top. Every closing action asks for a written reason — six months from now the difference between
 * a corrected defect and an accepted one is the note somebody left.
 *
 * <p>Recompute always shows its dry run first. Nothing on this screen writes to a farm's data
 * without a preview and a sentence.
 */
export function IntegrityPanel() {
  const { showToast } = useToast();
  const { data, isLoading, error } = useGetIntegritySummaryQuery({ size: 50 });
  const [run, { isLoading: running }] = useRunIntegrityChecksMutation();
  const [preview] = useLazyPreviewRecomputeQuery();
  const [applyRecompute, { isLoading: applying }] = useApplyRecomputeMutation();
  const [acceptDrift] = useAcceptDriftMutation();
  const [markFixed] = useMarkManuallyFixedMutation();

  const [target, setTarget] = useState<{ finding: FindingRow; action: Action } | null>(null);
  const [reason, setReason] = useState("");
  const [dryRun, setDryRun] = useState<RecomputeResult | null>(null);

  const close = () => {
    setTarget(null);
    setReason("");
    setDryRun(null);
  };

  const openAction = async (finding: FindingRow, action: Action) => {
    setTarget({ finding, action });
    setReason("");
    setDryRun(null);
    if (action === "recompute") {
      try {
        setDryRun(await preview({ id: finding.id }).unwrap());
      } catch (e) {
        showToast(apiErrorMessage(e), "error");
      }
    }
  };

  const confirm = async () => {
    if (!target) return;
    const { finding, action } = target;
    try {
      if (action === "recompute") {
        const result = await applyRecompute({ id: finding.id, reason: reason.trim() }).unwrap();
        showToast(`Valeur recalculée : ${result.before} → ${result.after}`, "success");
      } else if (action === "accept") {
        await acceptDrift({ id: finding.id, reason: reason.trim() }).unwrap();
        showToast("Écart accepté", "success");
      } else {
        await markFixed({ id: finding.id, reason: reason.trim() }).unwrap();
        showToast("Anomalie close", "success");
      }
      close();
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  const onRun = async () => {
    try {
      const report = await run().unwrap();
      showToast(
        `${report.checksRun} contrôles — ${report.opened} nouvelle(s), ${report.resolved} close(s)`,
        report.failed > 0 ? "warning" : "success",
      );
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  const findings = data?.findings.items ?? [];

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack
        direction="row"
        sx={{ alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 2 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Intégrité des données
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vérifications nocturnes. Ce qui touche à l&apos;argent ou aux effectifs est en haut.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Play size={15} />}
          onClick={onRun}
          disabled={running}
        >
          Lancer maintenant
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(error)}
        </Alert>
      )}

      <Stack direction="row" sx={{ gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Counter label="Critiques" value={data?.critical ?? 0} color={SEVERITY_COLOR.CRITICAL} />
        <Counter label="Avertissements" value={data?.warning ?? 0} color={SEVERITY_COLOR.WARNING} />
        <Counter label="Informations" value={data?.info ?? 0} color={SEVERITY_COLOR.INFO} />
      </Stack>

      <Card variant="outlined">
        <CardContent>
          {isLoading && <CircularProgress size={22} />}
          {!isLoading && findings.length === 0 && (
            <Stack direction="row" sx={{ gap: 1, alignItems: "center", py: 2 }}>
              <ShieldCheck size={18} color="#1b7f4d" />
              <Typography variant="body2" color="text.secondary">
                Aucune anomalie ouverte.
              </Typography>
            </Stack>
          )}
          {findings.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Sévérité</TableCell>
                  <TableCell>Contrôle</TableCell>
                  <TableCell>Entité</TableCell>
                  <TableCell>Attendu / réel</TableCell>
                  <TableCell>Ouverte depuis</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {findings.map((finding) => (
                  <TableRow key={finding.id}>
                    <TableCell>
                      <Chip
                        size="small"
                        label={finding.severity}
                        sx={{
                          bgcolor: SEVERITY_COLOR[finding.severity],
                          color: colors.neutral[0],
                          fontWeight: 700,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {finding.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {finding.checkKey}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {finding.entityType} #{finding.entityId}
                      {finding.farmId !== null && (
                        <Typography
                          component="div"
                          variant="caption"
                          color="text.secondary"
                        >
                          ferme {finding.farmId}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                        {finding.expectedValue} ≠ {finding.actualValue}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {finding.openForDays === 0 ? "aujourd'hui" : `${finding.openForDays} j`}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" sx={{ gap: 0.5, justifyContent: "flex-end" }}>
                        {finding.recomputable && (
                          <Button
                            size="small"
                            startIcon={<Calculator size={14} />}
                            onClick={() => openAction(finding, "recompute")}
                          >
                            Recalculer
                          </Button>
                        )}
                        <Button
                          size="small"
                          startIcon={<CheckCheck size={14} />}
                          onClick={() => openAction(finding, "manual")}
                        >
                          Corrigé
                        </Button>
                        <Button
                          size="small"
                          startIcon={<HandHelping size={14} />}
                          onClick={() => openAction(finding, "accept")}
                        >
                          Accepter
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={target !== null} onClose={close} maxWidth="sm" fullWidth>
        <DialogTitle>{target ? ACTION_TITLE[target.action] : ""}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {target ? ACTION_EXPLANATION[target.action] : ""}
          </DialogContentText>
          {target?.action === "recompute" && (
            <Alert severity={dryRun ? "info" : "warning"} sx={{ mb: 2 }}>
              {dryRun
                ? `Simulation : ${dryRun.before} → ${dryRun.after} (${dryRun.delta})`
                : "Simulation en cours…"}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Raison (obligatoire)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            helperText="Conservée dans le journal d'audit avec votre nom."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>Annuler</Button>
          <Button
            variant="contained"
            color={target?.action === "recompute" ? "primary" : "inherit"}
            disabled={
              reason.trim().length === 0 ||
              applying ||
              (target?.action === "recompute" && dryRun === null)
            }
            onClick={confirm}
          >
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
