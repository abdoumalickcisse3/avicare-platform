"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  useAttachPartnerFarmMutation,
  useCreatePartnerUserMutation,
  useDetachPartnerFarmMutation,
  useGenerateInviteCodeMutation,
  useGetAdminFarmsQuery,
  useGetAdminInviteCodesQuery,
  useGetAdminPartnerFarmsQuery,
  useGetAdminPartnerQuery,
  useGetAdminPartnerUsersQuery,
  useResetPartnerUserPasswordMutation,
  useRevokeInviteCodeMutation,
  useSetPartnerStatusMutation,
  useSetPartnerUserActiveMutation,
} from "@/store/api/adminApi";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/feedback/ToastProvider";
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

  const { data: allFarms = [] } = useGetAdminFarmsQuery();
  const { showToast } = useToast();

  const [detach] = useDetachPartnerFarmMutation();
  const [attachFarm, { isLoading: attaching }] = useAttachPartnerFarmMutation();
  const [createUser, { isLoading: creatingUser }] = useCreatePartnerUserMutation();
  const [generateCode, { isLoading: generatingCode }] = useGenerateInviteCodeMutation();
  const [setPartnerStatus] = useSetPartnerStatusMutation();
  const [setUserActive] = useSetPartnerUserActiveMutation();
  const [resetPassword] = useResetPartnerUserPasswordMutation();
  const [revokeCode] = useRevokeInviteCodeMutation();

  const [pendingDetach, setPendingDetach] = useState<AdminPartnerMembership | null>(null);
  const [confirmText, setConfirmText] = useState("");
  /**
   * The one-off value a staff action just produced. A temporary password and an invite code are
   * both secrets to hand over, but they are not the same secret: the password is shown once and
   * never again, the code stays listed below. Saying "shown once" about a code would teach people
   * to distrust the warning when it matters.
   */
  const [issued, setIssued] = useState<{ kind: "password" | "code"; value: string } | null>(null);

  const [attachOpen, setAttachOpen] = useState(false);
  const [attachFarmId, setAttachFarmId] = useState("");
  const [farmerAsked, setFarmerAsked] = useState(false);

  const [userOpen, setUserOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

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
        <Button
          size="small"
          color={partner.status === "ACTIVE" ? "error" : "primary"}
          onClick={async () => {
            try {
              await setPartnerStatus({
                partnerId,
                suspended: partner.status === "ACTIVE",
              }).unwrap();
              showToast(
                partner.status === "ACTIVE" ? "Partenaire suspendu" : "Partenaire réactivé",
                "success",
              );
            } catch (e) {
              showToast(apiErrorMessage(e), "error");
            }
          }}
        >
          {partner.status === "ACTIVE" ? "Suspendre" : "Réactiver"}
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", gap: 2, mb: 1.5 }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Fermes du réseau ({farms.length})
            </Typography>
            <Button size="small" variant="outlined" onClick={() => setAttachOpen(true)}>
              Rattacher une ferme
            </Button>
          </Stack>
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
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", gap: 2, mb: 1.5 }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Comptes de connexion ({users.length})
            </Typography>
            <Button size="small" variant="outlined" onClick={() => setUserOpen(true)}>
              Créer un compte
            </Button>
          </Stack>
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
                      setIssued({ kind: "password", value: r.temporaryPassword });
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
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", gap: 2, mb: 1.5 }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Codes d&apos;invitation
            </Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={generatingCode}
              onClick={async () => {
                try {
                  const code = await generateCode({ partnerId }).unwrap();
                  setIssued({ kind: "code", value: code.code });
                } catch (e) {
                  showToast(apiErrorMessage(e), "error");
                }
              }}
            >
              Générer un code
            </Button>
          </Stack>
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
        Attaching from here confirms the membership immediately, and the sharing defaults are
        operational-ON: activity, flock health and feed consumption start flowing at once, without
        the farmer being asked. That is legitimate when the farmer requested the link over the
        phone, and indefensible otherwise — so the dialog names what becomes visible and makes the
        operator state that the farmer asked. The platform cannot verify that claim; it can at least
        refuse to let it stay implicit. Cf. ADR-014.
      */}
      <Dialog open={attachOpen} onClose={() => setAttachOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Rattacher une ferme au réseau</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Dès le rattachement, {partner.name} verra <strong>l&apos;activité</strong>, la{" "}
            <strong>santé du cheptel</strong> et la <strong>consommation d&apos;aliment</strong> de
            cette ferme. Les ventes, les finances et les prévisions de recommande restent fermées
            tant que l&apos;éleveur ne les ouvre pas lui-même.
          </Alert>
          <TextField
            select
            fullWidth
            required
            label="Ferme"
            value={attachFarmId}
            onChange={(e) => setAttachFarmId(e.target.value)}
            sx={{ mb: 2 }}
          >
            {allFarms.map((f) => (
              <MenuItem key={f.farmId} value={String(f.farmId)}>
                {f.name} (#{f.farmId})
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Checkbox checked={farmerAsked} onChange={(e) => setFarmerAsked(e.target.checked)} />
            }
            label="L'éleveur m'a demandé ce rattachement"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAttachOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={attachFarmId === "" || !farmerAsked || attaching}
            onClick={async () => {
              try {
                await attachFarm({ partnerId, farmId: Number(attachFarmId) }).unwrap();
                showToast("Ferme rattachée", "success");
                setAttachOpen(false);
                setAttachFarmId("");
                setFarmerAsked(false);
              } catch (e) {
                showToast(apiErrorMessage(e), "error");
              }
            }}
          >
            Rattacher
          </Button>
        </DialogActions>
      </Dialog>

      {/* A partner with no account cannot sign in at all — this is what opens the portal to them. */}
      <Dialog open={userOpen} onClose={() => setUserOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Créer un compte de connexion</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Un mot de passe provisoire sera affiché une seule fois, à transmettre à la personne.
          </DialogContentText>
          <Stack sx={{ gap: 2 }}>
            <TextField
              autoFocus
              required
              type="email"
              label="Email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              fullWidth
            />
            <TextField
              label="Nom complet"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserOpen(false)}>Annuler</Button>
          <Button
            variant="contained"
            disabled={!userEmail.includes("@") || creatingUser}
            onClick={async () => {
              try {
                const created = await createUser({
                  partnerId,
                  email: userEmail.trim(),
                  fullName: userName.trim() || undefined,
                }).unwrap();
                setUserOpen(false);
                setUserEmail("");
                setUserName("");
                if (created.temporaryPassword) {
                  setIssued({ kind: "password", value: created.temporaryPassword });
                } else {
                  showToast("Compte créé", "success");
                }
              } catch (e) {
                showToast(apiErrorMessage(e), "error");
              }
            }}
          >
            Créer
          </Button>
        </DialogActions>
      </Dialog>

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
        <DialogTitle>
          {issued?.kind === "code" ? "Code d'invitation" : "Mot de passe temporaire"}
        </DialogTitle>
        <DialogContent>
          <Alert severity={issued?.kind === "code" ? "info" : "warning"} sx={{ mb: 2 }}>
            {issued?.kind === "code"
              ? "À transmettre au partenaire : ses éleveurs le saisiront pour rejoindre son réseau. Il reste consultable ci-dessous."
              : "Affiché une seule fois."}
          </Alert>
          <Typography
            sx={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", fontWeight: 700, userSelect: "all" }}
          >
            {issued?.value}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => issued && navigator.clipboard?.writeText(issued.value)}>
            Copier
          </Button>
          <Button variant="contained" onClick={() => setIssued(null)}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
