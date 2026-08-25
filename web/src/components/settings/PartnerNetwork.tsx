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
  Snackbar,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Handshake, KeyRound, Search } from "lucide-react";
import { useFarmRole } from "@/hooks/useFarmRole";
import {
  useDeclarePartnerMutation,
  useGetAvailablePartnersQuery,
  useGetMyPartnersQuery,
  useJoinNetworkMutation,
  useLeaveNetworkMutation,
  useUpdateSharingMutation,
} from "@/store/api/partnersApi";
import type { FarmPartner, PartnerType, SharingScopes } from "@/types";
import { colors } from "@/theme/tokens";

const TYPE_LABEL: Record<PartnerType, string> = {
  FEED_SUPPLIER: "Provendier",
  VET: "Vétérinaire",
};

const OPERATIONAL: { key: keyof SharingScopes; label: string }[] = [
  { key: "activity", label: "Activité de la ferme" },
  { key: "flockHealth", label: "Santé des lots" },
  { key: "feedConsumption", label: "Consommation d'aliment" },
];
const COMMERCIAL: { key: keyof SharingScopes; label: string }[] = [
  { key: "salesVolume", label: "Volumes de vente" },
  { key: "finances", label: "Finances" },
  { key: "restockForecast", label: "Prévisions de recommande" },
];

function scopesOf(p: FarmPartner): SharingScopes {
  return {
    activity: p.shareActivity,
    flockHealth: p.shareFlockHealth,
    feedConsumption: p.shareFeedConsumption,
    salesVolume: p.shareSalesVolume,
    finances: p.shareFinances,
    restockForecast: p.shareRestockForecast,
  };
}

function errorStatus(e: unknown): number | undefined {
  return typeof e === "object" && e !== null && "status" in e
    ? (e as { status?: number }).status
    : undefined;
}

/**
 * Farmer-facing "Mon réseau" surface: view partner memberships, adjust sharing sliders, declare a
 * partner from the directory, join by invite code, and leave a network. Writes are OWNER/MANAGER
 * only (the backend is the authority; the UI disables controls for other roles).
 */
export default function PartnerNetwork({ farmId }: { farmId: number }) {
  const role = useFarmRole(farmId);
  const canWrite = role === "OWNER" || role === "MANAGER";

  const { data: mine = [], isLoading } = useGetMyPartnersQuery({ farmId });
  const [updateSharing] = useUpdateSharingMutation();
  const [leaveNetwork] = useLeaveNetworkMutation();

  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [leaving, setLeaving] = useState<FarmPartner | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Optimistic local override of sliders, keyed by membership id and seeded from the server on load.
  const [override, setOverride] = useState<Record<number, SharingScopes>>({});

  const scopesFor = (p: FarmPartner): SharingScopes => override[p.membershipId] ?? scopesOf(p);

  const toggle = async (p: FarmPartner, key: keyof SharingScopes) => {
    const current = scopesFor(p);
    const next = { ...current, [key]: !current[key] };
    setOverride((o) => ({ ...o, [p.membershipId]: next }));
    try {
      await updateSharing({ farmId, membershipId: p.membershipId, scopes: next }).unwrap();
    } catch {
      setOverride((o) => ({ ...o, [p.membershipId]: current })); // revert
      setError("Impossible de mettre à jour le partage. Réessayez.");
    }
  };

  const confirmLeave = async () => {
    if (!leaving) return;
    try {
      await leaveNetwork({ farmId, membershipId: leaving.membershipId }).unwrap();
      setLeaving(null);
    } catch {
      setError("Impossible de quitter le réseau. Réessayez.");
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Mon réseau
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Vos partenaires (provendiers, vétérinaires) et ce que vous choisissez de partager avec
          eux. Vous restez propriétaire de vos données et pouvez quitter un réseau à tout moment.
        </Typography>
      </Box>

      {canWrite && (
        <Stack direction="row" spacing={1.5} sx={{ mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<KeyRound size={16} />}
            onClick={() => setJoinOpen(true)}
          >
            Rejoindre par code
          </Button>
          <Button
            variant="outlined"
            startIcon={<Search size={16} />}
            onClick={() => setDirectoryOpen(true)}
          >
            Parcourir les partenaires
          </Button>
        </Stack>
      )}

      {mine.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Handshake size={40} color={colors.primary[400]} />
            <Typography variant="h6" sx={{ fontWeight: 600, mt: 1 }}>
              Vous ne faites partie d&apos;aucun réseau
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Rejoignez le réseau d&apos;un partenaire par code d&apos;invitation, ou déclarez votre
              fournisseur depuis l&apos;annuaire.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {mine.map((p) => {
            const s = scopesFor(p);
            return (
              <Card key={p.membershipId}>
                <CardContent>
                  <Stack
                    direction="row"
                    sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}
                  >
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {p.partnerName ?? "Partenaire"}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                        {p.partnerType && (
                          <Chip size="small" label={TYPE_LABEL[p.partnerType]} />
                        )}
                        <Chip
                          size="small"
                          color={p.status === "CONFIRMED" ? "success" : "default"}
                          label={p.status === "CONFIRMED" ? "✓ Confirmé" : "⏳ En attente"}
                        />
                      </Stack>
                    </Box>
                    {canWrite && (
                      <Button color="error" size="small" onClick={() => setLeaving(p)}>
                        Quitter le réseau
                      </Button>
                    )}
                  </Stack>

                  <Typography sx={{ fontWeight: 700, fontSize: "0.8rem", mb: 0.5 }}>
                    Opérationnel
                  </Typography>
                  {OPERATIONAL.map((row) => (
                    <Stack
                      key={row.key}
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center" }}
                    >
                      <Typography variant="body2">{row.label}</Typography>
                      <Switch
                        checked={s[row.key]}
                        disabled={!canWrite}
                        onChange={() => toggle(p, row.key)}
                        slotProps={{ input: { "aria-label": `${p.membershipId} ${row.key}` } }}
                      />
                    </Stack>
                  ))}

                  <Typography sx={{ fontWeight: 700, fontSize: "0.8rem", mt: 1.5, mb: 0.5 }}>
                    Commercial &amp; Finances
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Privé par défaut. N&apos;activez que si vous souhaitez partager vos chiffres.
                  </Typography>
                  {COMMERCIAL.map((row) => (
                    <Stack
                      key={row.key}
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center" }}
                    >
                      <Typography variant="body2">{row.label}</Typography>
                      <Switch
                        checked={s[row.key]}
                        disabled={!canWrite}
                        onChange={() => toggle(p, row.key)}
                        slotProps={{ input: { "aria-label": `${p.membershipId} ${row.key}` } }}
                      />
                    </Stack>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      <DirectoryDialog
        farmId={farmId}
        open={directoryOpen}
        onClose={() => setDirectoryOpen(false)}
        onError={setError}
      />
      <JoinDialog
        farmId={farmId}
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onError={setError}
      />

      <Dialog open={leaving !== null} onClose={() => setLeaving(null)}>
        <DialogTitle>Quitter ce réseau ?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {leaving?.partnerName ?? "Ce partenaire"} n&apos;aura plus accès à vos données partagées.
            Vous pourrez le rejoindre à nouveau plus tard.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaving(null)}>Annuler</Button>
          <Button color="error" variant="contained" onClick={confirmLeave}>
            Quitter
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={error !== null}
        autoHideDuration={4000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function DirectoryDialog({
  farmId,
  open,
  onClose,
  onError,
}: {
  farmId: number;
  open: boolean;
  onClose: () => void;
  onError: (m: string) => void;
}) {
  const [type, setType] = useState<PartnerType | undefined>(undefined);
  const { data: partners = [], isFetching } = useGetAvailablePartnersQuery(
    { farmId, type },
    { skip: !open },
  );
  const [declarePartner] = useDeclarePartnerMutation();

  const declare = async (partnerId: number) => {
    try {
      await declarePartner({ farmId, partnerId }).unwrap();
      onClose();
    } catch (e) {
      onError(
        errorStatus(e) === 409
          ? "Vous faites déjà partie de ce réseau."
          : "Impossible de déclarer ce partenaire. Réessayez.",
      );
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Parcourir les partenaires</DialogTitle>
      <DialogContent>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={type ?? "ALL"}
          onChange={(_, v) => setType(v === "ALL" || v == null ? undefined : (v as PartnerType))}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="ALL">Tous</ToggleButton>
          <ToggleButton value="FEED_SUPPLIER">Provendiers</ToggleButton>
          <ToggleButton value="VET">Vétérinaires</ToggleButton>
        </ToggleButtonGroup>

        {isFetching ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : partners.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            Aucun partenaire disponible pour l&apos;instant.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {partners.map((p) => (
              <Stack
                key={p.id}
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  py: 1,
                  borderBottom: `1px solid ${colors.neutral[100]}`,
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{p.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {TYPE_LABEL[p.type]}
                  </Typography>
                </Box>
                <Button size="small" variant="outlined" onClick={() => declare(p.id)}>
                  Déclarer
                </Button>
              </Stack>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fermer</Button>
      </DialogActions>
    </Dialog>
  );
}

function JoinDialog({
  farmId,
  open,
  onClose,
  onError,
}: {
  farmId: number;
  open: boolean;
  onClose: () => void;
  onError: (m: string) => void;
}) {
  const [code, setCode] = useState("");
  const [joinNetwork, { isLoading }] = useJoinNetworkMutation();

  const submit = async () => {
    try {
      await joinNetwork({ farmId, code: code.trim() }).unwrap();
      setCode("");
      onClose();
    } catch (e) {
      onError(
        errorStatus(e) === 422
          ? "Code invalide, expiré ou épuisé."
          : errorStatus(e) === 409
            ? "Vous faites déjà partie de ce réseau."
            : "Impossible de rejoindre le réseau. Réessayez.",
      );
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Rejoindre par code</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Code d'invitation"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          sx={{ mt: 1 }}
          slotProps={{ htmlInput: { "aria-label": "Code d'invitation" } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={submit} disabled={isLoading || code.trim().length === 0}>
          Rejoindre
        </Button>
      </DialogActions>
    </Dialog>
  );
}
