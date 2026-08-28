"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  useDetachPartnerFarmMutation,
  useGetAdminInviteCodesQuery,
  useGetAdminPartnerFarmsQuery,
  useGetAdminPartnerQuery,
  useGetAdminPartnerUsersQuery,
  useResetPartnerUserPasswordMutation,
  useRevokeInviteCodeMutation,
  useSetPartnerUserActiveMutation,
} from "@/store/api/adminApi";
import type { AdminPartnerMembership } from "@/types";

/** The six sliders a farmer consents to, in the order the farmer sees them. */
const SCOPES: { key: keyof AdminPartnerMembership; label: string }[] = [
  { key: "shareActivity", label: "Activité" },
  { key: "shareFlockHealth", label: "Santé" },
  { key: "shareFeedConsumption", label: "Aliment" },
  { key: "shareSalesVolume", label: "Ventes" },
  { key: "shareFinances", label: "Finances" },
  { key: "shareRestockForecast", label: "Recommandes" },
];

export function PartnerDetailPanel({ partnerId }: { partnerId: number }) {
  const { data: partner } = useGetAdminPartnerQuery({ partnerId });
  const { data: farms = [] } = useGetAdminPartnerFarmsQuery({ partnerId });
  const { data: users = [] } = useGetAdminPartnerUsersQuery({ partnerId });
  const { data: codes = [] } = useGetAdminInviteCodesQuery({ partnerId });

  const [detach] = useDetachPartnerFarmMutation();
  const [setUserActive] = useSetPartnerUserActiveMutation();
  const [resetPassword] = useResetPartnerUserPasswordMutation();
  const [revokeCode] = useRevokeInviteCodeMutation();

  const [pendingDetach, setPendingDetach] = useState<AdminPartnerMembership | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [issued, setIssued] = useState<string | null>(null);

  if (!partner) return null;

  const expected = pendingDetach ? `ferme ${pendingDetach.farmId}` : "";

  return (
    <Stack spacing={3}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {partner.name}
        </Typography>
        <Chip size="small" variant="outlined" label={partner.type} />
        <Chip
          size="small"
          color={partner.status === "ACTIVE" ? "success" : "default"}
          label={partner.status}
        />
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
            Fermes du réseau ({farms.length})
          </Typography>
          {farms.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucune ferme rattachée.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {farms.map((m) => (
                <Box key={m.id}>
                  <Stack
                    direction="row"
                    sx={{ alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 0.5 }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Ferme #{m.farmId}
                    </Typography>
                    <Chip
                      size="small"
                      color={m.status === "CONFIRMED" ? "success" : "default"}
                      label={m.status}
                    />
                    <Button
                      size="small"
                      color="error"
                      onClick={() => {
                        setPendingDetach(m);
                        setConfirmText("");
                      }}
                    >
                      Détacher
                    </Button>
                  </Stack>
                  {/* Read-only: what the FARMER consented to, never editable from here. */}
                  <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                    {SCOPES.map((s) => (
                      <Chip
                        key={s.key}
                        size="small"
                        variant={m[s.key] ? "filled" : "outlined"}
                        color={m[s.key] ? "primary" : "default"}
                        label={s.label}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
            Comptes de connexion ({users.length})
          </Typography>
          {users.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucun compte. Ce partenaire ne peut pas se connecter au portail.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {users.map((u) => (
                <Stack
                  key={u.id}
                  direction="row"
                  sx={{ alignItems: "center", gap: 1.5, flexWrap: "wrap" }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {u.fullName ?? u.email}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {u.email}
                  </Typography>
                  <Chip
                    size="small"
                    color={u.active ? "success" : "default"}
                    label={u.active ? "Actif" : "Désactivé"}
                  />
                  <Button
                    size="small"
                    onClick={async () => {
                      const r = await resetPassword({
                        partnerId,
                        partnerUserId: u.id,
                      }).unwrap();
                      setIssued(r.temporaryPassword);
                    }}
                  >
                    Réinitialiser
                  </Button>
                  <Button
                    size="small"
                    color={u.active ? "error" : "primary"}
                    onClick={() =>
                      setUserActive({ partnerId, partnerUserId: u.id, active: !u.active })
                    }
                  >
                    {u.active ? "Désactiver" : "Réactiver"}
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
            Codes d&apos;invitation
          </Typography>
          {codes.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucun code généré.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {codes.map((c) => (
                <Stack
                  key={c.id}
                  direction="row"
                  sx={{ alignItems: "center", gap: 1.5, flexWrap: "wrap" }}
                >
                  <Typography sx={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                    {c.code}
                  </Typography>
                  <Chip
                    size="small"
                    color={c.active ? "success" : "default"}
                    label={c.active ? "Actif" : "Révoqué"}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {c.usesCount} adhésion{c.usesCount > 1 ? "s" : ""}
                    {c.maxUses != null && ` / ${c.maxUses}`}
                  </Typography>
                  {c.active && (
                    <Button
                      size="small"
                      color="error"
                      onClick={() => revokeCode({ partnerId, codeId: c.id })}
                    >
                      Révoquer
                    </Button>
                  )}
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/*
        Typed confirmation: detaching closes a third party's access to a farmer's data. It must not
        be one click away in a table.
      */}
      <Dialog open={pendingDetach !== null} onClose={() => setPendingDetach(null)} fullWidth maxWidth="xs">
        <DialogTitle>Détacher la ferme du réseau</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Le partenaire perdra immédiatement l&apos;accès aux données de cette ferme.
          </Alert>
          <DialogContentText sx={{ mb: 2 }}>
            Saisissez <strong>{expected}</strong> pour confirmer.
          </DialogContentText>
          <TextField
            fullWidth
            size="small"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            slotProps={{ htmlInput: { "aria-label": "confirmation" } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDetach(null)}>Annuler</Button>
          <Button
            variant="contained"
            color="error"
            disabled={confirmText.trim() !== expected}
            onClick={() => {
              if (pendingDetach) {
                detach({ partnerId, membershipId: pendingDetach.id });
              }
              setPendingDetach(null);
            }}
          >
            Détacher
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={issued !== null} onClose={() => setIssued(null)} fullWidth maxWidth="xs">
        <DialogTitle>Mot de passe temporaire</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Affiché une seule fois.
          </Alert>
          <Typography
            sx={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", fontWeight: 700, userSelect: "all" }}
          >
            {issued}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => issued && navigator.clipboard?.writeText(issued)}>Copier</Button>
          <Button variant="contained" onClick={() => setIssued(null)}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
