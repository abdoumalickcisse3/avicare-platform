"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Search, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import {
  useGetAdminMeQuery,
  useGetStaffCatalogQuery,
  useGetStaffQuery,
  useGrantStaffMutation,
  useLazySearchAdminUsersQuery,
  useRevokeStaffMutation,
  useSetStaffPermissionsMutation,
} from "@/store/api/adminApi";
import { apiErrorMessage } from "@/lib/apiError";
import type { AdminUserRow, StaffCatalogResource, StaffMemberRow } from "@/types";

const ALL = "*";

/** FR labels for the verbs, so the screen never shows a raw `resource:verb` to an operator. */
const VERB_LABELS: Record<string, string> = {
  read: "Consulter",
  write: "Modifier",
  "reset-password": "Réinitialiser un mot de passe",
  deactivate: "Désactiver un compte",
  open: "Ouvrir une session support",
  send: "Envoyer",
  export: "Exporter",
  delete: "Supprimer",
  manage: "Gérer",
  users: "Gérer les comptes",
  attach: "Rattacher une ferme",
  prospect: "Prospects",
};

function verbLabel(verb: string): string {
  return VERB_LABELS[verb] ?? verb;
}

/**
 * Grant, scope and withdraw console access.
 *
 * The three server guards are mirrored here — your own row is not editable, the wildcard is only
 * offered to a super-admin — so the console does not present an action it will refuse. The server
 * stays the authority: this only avoids offering a dead end.
 */
export function StaffManager() {
  const { data: me } = useGetAdminMeQuery();
  const { data: staff = [], isLoading } = useGetStaffQuery();
  const { data: catalog = [] } = useGetStaffCatalogQuery();
  const [grantStaff] = useGrantStaffMutation();
  const [revokeStaff] = useRevokeStaffMutation();
  const [setPermissions, { isLoading: saving }] = useSetStaffPermissionsMutation();
  const [searchUsers, { data: candidates = [], isFetching: searching }] =
    useLazySearchAdminUsersQuery();

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<StaffMemberRow | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const iAmSuperAdmin = me?.superAdmin ?? false;
  const superAdminCount = useMemo(() => staff.filter((s) => s.superAdmin).length, [staff]);

  const openEditor = (member: StaffMemberRow) => {
    setError(null);
    setDraft(member.permissions);
    setEditing(member);
  };

  const toggle = (permission: string) =>
    setDraft((current) =>
      current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission],
    );

  const toggleSuperAdmin = (on: boolean) => setDraft(on ? [ALL] : []);

  const onSave = async () => {
    if (!editing) return;
    setError(null);
    try {
      await setPermissions({ userId: editing.userId, permissions: draft }).unwrap();
      setEditing(null);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const onGrant = async (user: AdminUserRow) => {
    setError(null);
    try {
      await grantStaff({ userId: user.userId }).unwrap();
      setQuery("");
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const onRevoke = async (member: StaffMemberRow) => {
    setError(null);
    try {
      await revokeStaff({ userId: member.userId }).unwrap();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const isSelf = (member: StaffMemberRow) => member.userId === me?.userId;
  const isLastSuperAdmin = (member: StaffMemberRow) => member.superAdmin && superAdminCount <= 1;

  const blockedReason = (member: StaffMemberRow): string | null => {
    if (isSelf(member)) return "Vous ne pouvez pas modifier votre propre accès.";
    if (isLastSuperAdmin(member)) return "Il doit rester au moins un super-administrateur.";
    return null;
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Personnel de la plateforme
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Qui accède à la console, et jusqu&apos;où. Chaque modification est journalisée.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Donner l&apos;accès à un compte existant
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <TextField
              size="small"
              fullWidth
              label="Email, nom ou téléphone"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) searchUsers({ q: query.trim() });
              }}
            />
            <Button
              variant="outlined"
              onClick={() => query.trim() && searchUsers({ q: query.trim() })}
              startIcon={searching ? <CircularProgress size={16} /> : <Search size={16} />}
            >
              Chercher
            </Button>
          </Stack>
          {candidates.length > 0 && (
            <Stack spacing={1}>
              {candidates.map((c) => {
                const alreadyStaff = c.role === "ADMIN";
                return (
                  <Stack
                    key={c.userId}
                    direction="row"
                    sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}
                  >
                    <Box>
                      <Typography variant="body2">{c.fullName ?? c.email}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {c.email}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={alreadyStaff || !c.active}
                      startIcon={<UserPlus size={16} />}
                      onClick={() => onGrant(c)}
                    >
                      {alreadyStaff ? "Déjà membre" : "Donner l'accès"}
                    </Button>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ overflowX: "auto" }}>
          {isLoading ? (
            <CircularProgress size={22} />
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Compte</TableCell>
                  <TableCell>Permissions</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {staff.map((member) => {
                  const blocked = blockedReason(member);
                  return (
                    <TableRow key={member.userId}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {member.fullName ?? member.email}
                          {isSelf(member) && (
                            <Chip size="small" label="vous" sx={{ ml: 1 }} variant="outlined" />
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {member.email}
                          {!member.active && " · compte désactivé"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {member.superAdmin ? (
                          <Chip
                            size="small"
                            color="primary"
                            icon={<ShieldCheck size={14} />}
                            label="Super-administrateur"
                          />
                        ) : member.permissions.length === 0 ? (
                          <Typography variant="caption" color="text.secondary">
                            Aucune permission — accès sans effet
                          </Typography>
                        ) : (
                          <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap" }}>
                            {member.permissions.map((p) => (
                              <Chip key={p} size="small" variant="outlined" label={p} />
                            ))}
                          </Stack>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" sx={{ gap: 1, justifyContent: "flex-end" }}>
                          <Tooltip title={blocked ?? ""}>
                            <span>
                              <Button
                                size="small"
                                disabled={!!blocked}
                                onClick={() => openEditor(member)}
                              >
                                Permissions
                              </Button>
                            </span>
                          </Tooltip>
                          <Tooltip title={blocked ?? ""}>
                            <span>
                              <Button
                                size="small"
                                color="error"
                                disabled={!!blocked}
                                startIcon={<Trash2 size={15} />}
                                onClick={() => onRevoke(member)}
                              >
                                Retirer
                              </Button>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Permissions — {editing?.fullName ?? editing?.email}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Tooltip
              title={
                iAmSuperAdmin ? "" : "Seul un super-administrateur peut accorder toutes les permissions."
              }
            >
              <span>
                <FormControlLabel
                  control={
                    <Switch
                      checked={draft.includes(ALL)}
                      disabled={!iAmSuperAdmin}
                      onChange={(e) => toggleSuperAdmin(e.target.checked)}
                    />
                  }
                  label="Super-administrateur (toutes les permissions)"
                />
              </span>
            </Tooltip>
            <Divider />
            {draft.includes(ALL) ? (
              <Alert severity="info">
                Ce compte a toutes les permissions, présentes et futures. Désactivez le curseur pour
                choisir des permissions précises.
              </Alert>
            ) : (
              catalog.map((resource: StaffCatalogResource) => (
                <Box key={resource.resource}>
                  <Typography variant="subtitle2">{resource.label}</Typography>
                  <Stack sx={{ pl: 1 }}>
                    {resource.verbs.map((verb) => {
                      const permission = `${resource.resource}:${verb}`;
                      return (
                        <FormControlLabel
                          key={permission}
                          control={
                            <Checkbox
                              size="small"
                              checked={draft.includes(permission)}
                              onChange={() => toggle(permission)}
                            />
                          }
                          label={verbLabel(verb)}
                        />
                      );
                    })}
                  </Stack>
                </Box>
              ))
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Annuler</Button>
          <Button variant="contained" onClick={onSave} disabled={saving}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
