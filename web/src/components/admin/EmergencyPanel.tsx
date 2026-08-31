"use client";

import { useEffect, useState } from "react";
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
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { OctagonX, TimerReset, Undo2 } from "lucide-react";
import {
  useActivateKillswitchMutation,
  useExtendKillswitchMutation,
  useGetFlagHistoryQuery,
  useGetFlagsQuery,
  useLiftKillswitchMutation,
  useSetFlagEnabledMutation,
} from "@/store/api/adminApi";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/feedback/ToastProvider";
import { colors } from "@/theme/tokens";
import type { FeatureFlagRow } from "@/types";

/** FR labels for the switches; an unknown key falls back to itself. */
const LABELS: Record<string, string> = {
  "module.poultry.broiler": "Volaille chair",
  "module.poultry.layer": "Volaille ponte",
  "module.health.basic": "Santé basique",
  "module.health.advanced": "Santé avancée",
  "module.commercial.basic": "Commercial basique",
  "module.commercial.advanced": "Commercial avancé",
  "module.inventory": "Stocks",
  "module.finance": "Finance",
  "module.kpi.advanced": "KPI avancés",
  "module.buyer_portal": "Portail acheteur",
  "module.qr_codes": "QR codes",
  "module.api_access": "Accès API",
  "cascade.d18.stock_consumption": "Cascade stock (D18)",
  "assistant.enabled": "Assistant IA",
  "whatsapp.outbound": "Envois WhatsApp",
};

const ACTION_LABELS: Record<string, string> = {
  killswitch: "Coupure",
  "killswitch.extend": "Prolongation",
  "killswitch.lift": "Levée",
  "killswitch.expire": "Expiration automatique",
  "global.enable": "Réactivé",
  "global.disable": "Désactivé",
};

/**
 * mm:ss left, ticking locally so the number moves without hammering the API.
 *
 * <p>Counts down from the server's own figure rather than from the expiry timestamp: a field laptop
 * with a skewed clock would otherwise show a cut as already over. The caller remounts it (via
 * {@code key}) whenever a fresh figure arrives, which is also why the effect only installs the
 * interval and never writes state on its own.
 */
function Countdown({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const timer = setInterval(() => setLeft((value) => Math.max(value - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return <span>{`${mm}:${ss}`}</span>;
}

/**
 * The emergency screen.
 *
 * <p>Reads as an instrument panel rather than a settings page: a cut here stops a feature for every
 * farm on the platform at once, so the destructive action asks for a written reason before it is
 * available, and anything currently cut is shown at the top with its countdown — a switch nobody
 * remembers to lift becomes an outage we inflicted on ourselves.
 */
export function EmergencyPanel() {
  const { showToast } = useToast();
  const { data: flags, isLoading, error } = useGetFlagsQuery(undefined, { pollingInterval: 30_000 });
  const { data: history } = useGetFlagHistoryQuery();
  const [activate, { isLoading: cutting }] = useActivateKillswitchMutation();
  const [extend] = useExtendKillswitchMutation();
  const [lift] = useLiftKillswitchMutation();
  const [setEnabled] = useSetFlagEnabledMutation();

  const [target, setTarget] = useState<FeatureFlagRow | null>(null);
  const [reason, setReason] = useState("");

  const label = (key: string) => LABELS[key] ?? key;
  const cut = (flags ?? []).filter((f) => f.killswitchActive);

  const closeDialog = () => {
    setTarget(null);
    setReason("");
  };

  const onCut = async () => {
    if (!target) return;
    try {
      await activate({ flagKey: target.flagKey, reason: reason.trim() }).unwrap();
      showToast(`Coupure activée sur ${label(target.flagKey)}`, "warning");
      closeDialog();
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  const run = async (promise: Promise<unknown>, message: string) => {
    try {
      await promise;
      showToast(message, "success");
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Urgence
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Couper une fonctionnalité l&apos;arrête pour <strong>toutes les fermes</strong>, y compris
        pour le personnel. Une coupure se lève d&apos;elle-même au bout de 30 minutes.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(error)}
        </Alert>
      )}

      {cut.length > 0 && (
        <Alert severity="warning" icon={<OctagonX size={18} />} sx={{ mb: 2 }}>
          {cut.length === 1
            ? "1 fonctionnalité est actuellement coupée."
            : `${cut.length} fonctionnalités sont actuellement coupées.`}
        </Alert>
      )}

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          {isLoading && <CircularProgress size={22} />}
          {flags && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fonctionnalité</TableCell>
                  <TableCell>Servie</TableCell>
                  <TableCell>État</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {flags.map((flag) => (
                  <TableRow
                    key={flag.flagKey}
                    sx={{ bgcolor: flag.killswitchActive ? "#fdecea" : undefined }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {label(flag.flagKey)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {flag.flagKey}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Switch
                        size="small"
                        checked={flag.enabledGlobally}
                        slotProps={{ input: { "aria-label": `Servir ${label(flag.flagKey)}` } }}
                        onChange={(e) =>
                          run(
                            setEnabled({
                              flagKey: flag.flagKey,
                              enabled: e.target.checked,
                            }).unwrap(),
                            e.target.checked ? "Fonctionnalité réactivée" : "Fonctionnalité désactivée",
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {flag.killswitchActive ? (
                        <Stack sx={{ gap: 0.25 }}>
                          <Chip
                            size="small"
                            color="error"
                            label={
                              <>
                                Coupée —{" "}
                                <Countdown
                                  key={flag.secondsRemaining ?? 0}
                                  seconds={flag.secondsRemaining ?? 0}
                                />
                              </>
                            }
                          />
                          <Typography variant="caption" color="text.secondary">
                            {flag.killswitchReason}
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {flag.killswitchActive ? (
                        <Stack direction="row" sx={{ gap: 1, justifyContent: "flex-end" }}>
                          <Button
                            size="small"
                            startIcon={<TimerReset size={15} />}
                            onClick={() =>
                              run(
                                extend({ flagKey: flag.flagKey }).unwrap(),
                                "Coupure prolongée de 30 minutes",
                              )
                            }
                          >
                            Prolonger
                          </Button>
                          <Button
                            size="small"
                            startIcon={<Undo2 size={15} />}
                            onClick={() =>
                              run(lift({ flagKey: flag.flagKey }).unwrap(), "Coupure levée")
                            }
                          >
                            Lever
                          </Button>
                        </Stack>
                      ) : (
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          startIcon={<OctagonX size={15} />}
                          onClick={() => setTarget(flag)}
                        >
                          Couper
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        30 derniers changements
      </Typography>
      <Card variant="outlined">
        <CardContent>
          {(history ?? []).length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Aucun changement enregistré.
            </Typography>
          )}
          <Stack sx={{ gap: 1 }}>
            {(history ?? []).map((entry, index) => (
              <Stack
                key={`${entry.at}-${index}`}
                direction="row"
                sx={{ gap: 1, alignItems: "baseline", flexWrap: "wrap" }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 130 }}>
                  {new Date(entry.at).toLocaleString("fr-FR")}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </Typography>
                <Typography variant="body2">{label(entry.flagKey ?? "")}</Typography>
                {entry.reason && (
                  <Typography variant="body2" color="text.secondary">
                    — {entry.reason}
                  </Typography>
                )}
                {entry.actorUserId === null && (
                  <Chip size="small" variant="outlined" label="automatique" />
                )}
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={target !== null} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: colors.neutral[900] }}>
          Couper « {target ? label(target.flagKey) : ""} » ?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            La fonctionnalité cessera de répondre pour toutes les fermes, immédiatement. Les appels
            concernés recevront une erreur « temporairement indisponible ».
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Raison (obligatoire)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            helperText="Elle est envoyée à l'astreinte et affichée pendant toute la coupure."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Annuler</Button>
          <Button
            color="error"
            variant="contained"
            disabled={reason.trim().length === 0 || cutting}
            onClick={onCut}
          >
            Couper maintenant
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
