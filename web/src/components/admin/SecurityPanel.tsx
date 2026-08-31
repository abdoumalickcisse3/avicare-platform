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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { LockKeyholeOpen, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  useBlockIpMutation,
  useGetSecurityOverviewQuery,
  useUnblockIpMutation,
} from "@/store/api/adminApi";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/feedback/ToastProvider";
import { colors } from "@/theme/tokens";
import type { BlockedIpRow, SecurityEventRow } from "@/types";

const SEVERITY_COLOR: Record<SecurityEventRow["severity"], string> = {
  CRITICAL: "#b3261e",
  WARNING: "#b26a00",
  INFO: colors.neutral[600],
};

const EVENT_LABELS: Record<SecurityEventRow["eventType"], string> = {
  FAILED_LOGIN: "Connexion échouée",
  BRUTEFORCE_DETECTED: "Force brute détectée",
  RATE_LIMIT_EXCEEDED: "Débit dépassé",
  SIGNUP_ANOMALY: "Inscriptions en rafale",
  IP_BLOCKED: "Adresse bloquée",
  IP_UNBLOCKED: "Adresse débloquée",
};

function Counter({ label, value, alarming }: { label: string; value: number; alarming?: boolean }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 140 }}>
      <CardContent>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            color: alarming && value > 0 ? SEVERITY_COLOR.CRITICAL : colors.neutral[800],
          }}
        >
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
 * The security screen.
 *
 * <p>Two halves, because they answer different questions. The blocked list is the one that matters
 * when a farmer calls saying they cannot get in — releasing an address is the fix, and it is one
 * click away with a reason attached. The timeline below is for understanding afterwards.
 */
export function SecurityPanel() {
  const { showToast } = useToast();
  const [days, setDays] = useState(7);
  const { data, isLoading, error } = useGetSecurityOverviewQuery({ days });
  const [blockIp, { isLoading: blocking }] = useBlockIpMutation();
  const [unblockIp] = useUnblockIpMutation();

  const [blockOpen, setBlockOpen] = useState(false);
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");
  const [release, setRelease] = useState<BlockedIpRow | null>(null);
  const [releaseReason, setReleaseReason] = useState("");

  const counters = data?.counters ?? {};

  const onBlock = async () => {
    try {
      await blockIp({ ipAddress: ip.trim(), reason: reason.trim(), minutes: 60 }).unwrap();
      showToast(`${ip.trim()} bloquée pour 1 heure`, "warning");
      setBlockOpen(false);
      setIp("");
      setReason("");
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  const onRelease = async () => {
    if (!release) return;
    try {
      await unblockIp({
        ipAddress: release.ipAddress,
        reason: releaseReason.trim(),
        minutes: 1,
      }).unwrap();
      showToast(`${release.ipAddress} débloquée`, "success");
      setRelease(null);
      setReleaseReason("");
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Sécurité
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tentatives d&apos;intrusion et adresses refusées. Un blocage automatique dure une heure.
          </Typography>
        </Box>
        <Stack direction="row" sx={{ gap: 1, alignItems: "center" }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={days}
            onChange={(_, value) => value && setDays(value)}
          >
            <ToggleButton value={1}>24 h</ToggleButton>
            <ToggleButton value={7}>7 j</ToggleButton>
            <ToggleButton value={30}>30 j</ToggleButton>
          </ToggleButtonGroup>
          <Button variant="outlined" color="error" onClick={() => setBlockOpen(true)}>
            Bloquer une adresse
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(error)}
        </Alert>
      )}

      {(counters.critical ?? 0) > 0 && (
        <Alert severity="error" icon={<ShieldAlert size={18} />} sx={{ mb: 2 }}>
          {counters.critical} tentative(s) d&apos;intrusion sur la période.
        </Alert>
      )}

      <Stack direction="row" sx={{ gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Counter label="Intrusions" value={counters.critical ?? 0} alarming />
        <Counter label="Connexions échouées" value={counters.failedLogins ?? 0} />
        <Counter label="Requêtes bridées" value={counters.rateLimited ?? 0} />
        <Counter label="Adresses bloquées" value={counters.blockedNow ?? 0} alarming />
      </Stack>

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Adresses actuellement refusées
      </Typography>
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          {(data?.blocked ?? []).length === 0 && (
            <Stack direction="row" sx={{ gap: 1, alignItems: "center", py: 1 }}>
              <ShieldCheck size={18} color="#1b7f4d" />
              <Typography variant="body2" color="text.secondary">
                Aucune adresse bloquée.
              </Typography>
            </Stack>
          )}
          {(data?.blocked ?? []).length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Adresse</TableCell>
                  <TableCell>Raison</TableCell>
                  <TableCell>Par</TableCell>
                  <TableCell>Reste</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {(data?.blocked ?? []).map((blocked) => (
                  <TableRow key={blocked.ipAddress}>
                    <TableCell sx={{ fontFamily: "monospace" }}>{blocked.ipAddress}</TableCell>
                    <TableCell>{blocked.reason}</TableCell>
                    <TableCell>
                      {blocked.blockedBy === "AUTO_BRUTEFORCE" ? (
                        <Chip size="small" variant="outlined" label="automatique" />
                      ) : (
                        blocked.blockedBy
                      )}
                    </TableCell>
                    <TableCell>{blocked.minutesRemaining} min</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        startIcon={<LockKeyholeOpen size={14} />}
                        onClick={() => setRelease(blocked)}
                      >
                        Débloquer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Journal
      </Typography>
      <Card variant="outlined">
        <CardContent>
          {isLoading && <CircularProgress size={22} />}
          {!isLoading && (data?.events ?? []).length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Rien à signaler sur la période.
            </Typography>
          )}
          {(data?.events ?? []).length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Événement</TableCell>
                  <TableCell>Adresse</TableCell>
                  <TableCell>Compte visé</TableCell>
                  <TableCell>Suite donnée</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data?.events ?? []).map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{new Date(event.createdAt).toLocaleString("fr-FR")}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={EVENT_LABELS[event.eventType] ?? event.eventType}
                        sx={{
                          bgcolor: SEVERITY_COLOR[event.severity],
                          color: colors.neutral[0],
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                      {event.ipAddress}
                    </TableCell>
                    <TableCell>{event.email ?? "—"}</TableCell>
                    <TableCell>{event.actionTaken ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={blockOpen} onClose={() => setBlockOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bloquer une adresse</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            L&apos;adresse sera refusée pendant une heure, sur toutes les routes. Attention : au
            Sénégal, une ville entière peut partager la même adresse d&apos;opérateur.
          </DialogContentText>
          <Stack sx={{ gap: 2 }}>
            <TextField
              autoFocus
              label="Adresse IP"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              fullWidth
            />
            <TextField
              label="Raison (obligatoire)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBlockOpen(false)}>Annuler</Button>
          <Button
            color="error"
            variant="contained"
            disabled={ip.trim().length === 0 || reason.trim().length === 0 || blocking}
            onClick={onBlock}
          >
            Bloquer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={release !== null} onClose={() => setRelease(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Débloquer {release?.ipAddress}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            L&apos;adresse pourra de nouveau se connecter immédiatement.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Raison (obligatoire)"
            value={releaseReason}
            onChange={(e) => setReleaseReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRelease(null)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={releaseReason.trim().length === 0}
            onClick={onRelease}
          >
            Débloquer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
