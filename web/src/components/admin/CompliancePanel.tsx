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
import { Check, Download, TriangleAlert, X } from "lucide-react";
import {
  useExportFarmDataMutation,
  useGetDeletedFarmsQuery,
  useLazyGetPurgePreviewQuery,
  usePurgeFarmMutation,
} from "@/store/api/adminApi";
import { apiErrorMessage } from "@/lib/apiError";
import type { FarmPurgePreview } from "@/types";

function Condition({ met, label }: { met: boolean; label: string }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
      {met ? <Check size={16} color="green" /> : <X size={16} color="#b3261e" />}
      <Typography variant="body2" color={met ? "text.primary" : "text.secondary"}>
        {label}
      </Typography>
    </Stack>
  );
}

/** Hands the bundle to the browser as a file. */
function download(farm: FarmPurgePreview, bundle: unknown) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `ferme-${farm.farmId}-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Portability and erasure.
 *
 * Purging a farm is the most destructive action on the platform — every table referencing a farm
 * is ON DELETE CASCADE, so the row takes flocks, sales and invoices with it. The screen shows what
 * would go, which conditions are met, and asks for the farm's name typed out: a checkbox is clicked
 * by reflex, a name has to be read first.
 *
 * The server enforces all of it independently; nothing here is the gate.
 */
export function CompliancePanel() {
  const { data: farms = [], isLoading } = useGetDeletedFarmsQuery();
  const [exportFarm, { isLoading: exporting }] = useExportFarmDataMutation();
  const [purgeFarm, { isLoading: purging }] = usePurgeFarmMutation();
  // The row is a snapshot from page load. What the dialog shows must be what the purge will
  // destroy, so the preview is asked again — the backend recomputes the counts by running the
  // exporters, the same source the erasure itself uses.
  const [fetchPreview, { isFetching: previewing }] = useLazyGetPurgePreviewQuery();

  const [target, setTarget] = useState<FarmPurgePreview | null>(null);
  const [typedName, setTypedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onExport = async (farm: FarmPurgePreview) => {
    setError(null);
    try {
      const bundle = await exportFarm({ farmId: farm.farmId }).unwrap();
      download(farm, bundle);
      setNotice(`Export de « ${farm.farmName} » téléchargé.`);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const onPurge = async () => {
    if (!target) return;
    setError(null);
    try {
      await purgeFarm({ farmId: target.farmId, confirmationName: typedName }).unwrap();
      setNotice(`« ${target.farmName} » a été effacée définitivement.`);
      setTarget(null);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const openPurge = async (farm: FarmPurgePreview) => {
    setError(null);
    setTypedName("");
    setTarget(farm);
    try {
      setTarget(await fetchPreview(farm.farmId).unwrap());
    } catch (e) {
      // Keep the row's figures rather than an empty dialog, but say they may be stale: refusing to
      // open would leave an administrator unable to act at all.
      setError(`Aperçu non rafraîchi (${apiErrorMessage(e)}) — les chiffres ci-dessous datent du chargement de la page.`);
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Conformité
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Portabilité des données et droit à l&apos;effacement. Chaque action est journalisée.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}

      <Alert severity="info">
        L&apos;anonymisation d&apos;un compte se fait depuis l&apos;écran <b>Utilisateurs</b>. Un
        compte ne se supprime pas : 59 colonnes du schéma le référencent, la suppression échouerait.
        Ses données personnelles sont remplacées, son historique reste vrai.
      </Alert>

      <Card variant="outlined">
        <CardContent sx={{ overflowX: "auto" }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Fermes supprimées
          </Typography>
          {isLoading ? (
            <CircularProgress size={22} />
          ) : farms.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucune ferme supprimée en attente.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ferme</TableCell>
                  <TableCell>Supprimée</TableCell>
                  <TableCell>Export</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {farms.map((farm) => (
                  <TableRow key={farm.farmId}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {farm.farmName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {farm.daysSinceDeletion !== null
                        ? `il y a ${farm.daysSinceDeletion} jour(s)`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={farm.exportDone ? "success" : "default"}
                        label={farm.exportDone ? "effectué" : "aucun"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" sx={{ gap: 1, justifyContent: "flex-end" }}>
                        <Button
                          size="small"
                          startIcon={<Download size={15} />}
                          disabled={exporting}
                          onClick={() => onExport(farm)}
                        >
                          Exporter
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<TriangleAlert size={15} />}
                          onClick={() => void openPurge(farm)}
                        >
                          Purger
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

      <Dialog open={!!target} onClose={() => setTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Purge définitive — {target?.farmName}</DialogTitle>
        <DialogContent dividers>
          {target && (
            <Stack spacing={2}>
              <Alert severity="error">
                Cette action est irréversible et n&apos;a pas de sauvegarde de secours immédiate.
              </Alert>
              {previewing && (
                <Typography variant="caption" color="text.secondary">
                  Recomptage en cours…
                </Typography>
              )}
              <Box>
                <Typography variant="subtitle2">Seront effacés définitivement</Typography>
                <Stack sx={{ pl: 1, pt: 0.5 }}>
                  {Object.entries(target.counts ?? {}).length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Aucune donnée rattachée.
                    </Typography>
                  ) : (
                    Object.entries(target.counts ?? {}).map(([key, n]) => (
                      <Typography key={key} variant="body2">
                        {n} {key}
                      </Typography>
                    ))
                  )}
                </Stack>
              </Box>
              <Stack spacing={0.5}>
                <Condition met={target.exportDone} label="Export effectué depuis la suppression" />
                <Condition
                  met={target.retentionElapsed}
                  label="Supprimée depuis plus de 30 jours"
                />
              </Stack>
              <TextField
                label="Tapez le nom exact pour confirmer"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                fullWidth
                size="small"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTarget(null)}>Annuler</Button>
          <Button
            color="error"
            variant="contained"
            onClick={onPurge}
            disabled={
              purging || previewing || !target?.purgeable || typedName !== target?.farmName
            }
          >
            Purger définitivement
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
