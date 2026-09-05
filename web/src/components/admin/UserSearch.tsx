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
import { KeyRound, LifeBuoy, LogOut, Search } from "lucide-react";
import {
  useAnonymizeUserMutation,
  useGetAdminMeQuery,
  useImpersonateMutation,
  useLazySearchAdminUsersQuery,
  useResetAdminUserPasswordMutation,
  useRevokeUserSessionsMutation,
  useSetAdminUserActiveMutation,
} from "@/store/api/adminApi";
import { apiErrorMessage } from "@/lib/apiError";
import { impersonation } from "@/lib/impersonation";
import { tokenStorage } from "@/lib/storage";
import type { AdminUserRow } from "@/types";

/**
 * Cross-tenant account support.
 *
 * Search is explicit (a button, not as-you-type): the query hits every account on the platform, so
 * it should be a deliberate act, not a side effect of keystrokes.
 */
export function UserSearch() {
  const [query, setQuery] = useState("");
  const [search, { data: users = [], isFetching, isUninitialized }] =
    useLazySearchAdminUsersQuery();
  const [resetPassword] = useResetAdminUserPasswordMutation();
  const [setActive] = useSetAdminUserActiveMutation();
  const [revokeSessions] = useRevokeUserSessionsMutation();
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openSupport] = useImpersonateMutation();
  const [anonymize] = useAnonymizeUserMutation();
  const { data: me } = useGetAdminMeQuery();
  const [toAnonymize, setToAnonymize] = useState<AdminUserRow | null>(null);

  // Erasure is its own permission: answering a data request and destroying an identity are not
  // the same right, and holding the first must not imply the second.
  const canAnonymize =
    me?.permissions.includes("*") ||
    me?.permissions.includes("compliance:delete") ||
    me?.permissions.includes("compliance:*") ||
    false;

  // Erasure is irreversible, so the dialog asks for the address to be typed back rather than for
  // a second click, and a failure is shown instead of swallowed: an administrator who is told
  // nothing assumes the request was honoured.
  const [anonymizeError, setAnonymizeError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [anonymizing, setAnonymizing] = useState(false);

  const closeAnonymize = () => {
    setToAnonymize(null);
    setConfirmEmail("");
    setAnonymizeError(null);
  };

  const onAnonymize = async () => {
    if (!toAnonymize) return;
    setAnonymizing(true);
    setAnonymizeError(null);
    try {
      await anonymize({ userId: toAnonymize.userId }).unwrap();
      closeAnonymize();
      // The row still shows the old identity until the search is replayed.
      if (query.trim().length > 0) search({ q: query.trim() });
    } catch (err) {
      setAnonymizeError(apiErrorMessage(err));
    } finally {
      setAnonymizing(false);
    }
  };
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  /**
   * Deactivating does not end the session on its own: the access token already in the browser keeps
   * working until it expires, so a dismissed or compromised account stays usable in the meantime.
   * The two go together, and the revocation is what makes the deactivation bite.
   */
  const onDeactivate = async (user: AdminUserRow) => {
    setActionError(null);
    try {
      await setActive({ userId: user.userId, active: false }).unwrap();
      await revokeSessions({ userId: user.userId }).unwrap();
    } catch (e) {
      setActionError(apiErrorMessage(e));
    }
  };

  /** Cut the sessions of an account that stays active — the answer to a suspected compromise. */
  const onCutSessions = async (user: AdminUserRow) => {
    setActionError(null);
    try {
      await revokeSessions({ userId: user.userId }).unwrap();
      setNotice(`Les sessions de ${user.email} ont été coupées.`);
    } catch (e) {
      setActionError(apiErrorMessage(e));
    }
  };

  const onSearch = () => {
    if (query.trim().length > 0) search({ q: query.trim() });
  };

  const onSupport = async (user: AdminUserRow) => {
    const { accessToken } = await openSupport({ userId: user.userId }).unwrap();
    // Stash whatever farmer session was open so leaving support puts it back.
    impersonation.set({
      targetLabel: user.fullName ?? user.email,
      targetUserId: user.userId,
      previousAccess: tokenStorage.getAccess(),
      previousRefresh: tokenStorage.getRefresh(),
    });
    // The support token IS the farmer token: the app must behave exactly as it does for them.
    tokenStorage.set(accessToken, "");
    window.location.href = "/dashboard";
  };

  const onReset = async (user: AdminUserRow) => {
    const result = await resetPassword({ userId: user.userId }).unwrap();
    setIssued({ email: user.email, password: result.temporaryPassword });
  };

  return (
    <Card>
      <CardContent>
        {actionError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
            {actionError}
          </Alert>
        )}
        {notice && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        )}
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Utilisateurs
        </Typography>

        <Stack direction="row" sx={{ gap: 1, mb: 2, flexWrap: "wrap" }}>
          <TextField
            size="small"
            placeholder="E-mail, nom ou téléphone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            sx={{ minWidth: 280 }}
          />
          <Button
            variant="contained"
            onClick={onSearch}
            disabled={isFetching || query.trim().length === 0}
            startIcon={<Search size={16} />}
          >
            Rechercher
          </Button>
        </Stack>

        {isUninitialized ? (
          <Typography variant="body2" color="text.secondary">
            Saisissez un e-mail, un nom ou un téléphone pour chercher un compte.
          </Typography>
        ) : users.length === 0 && !isFetching ? (
          <Typography variant="body2" color="text.secondary">
            Aucun compte ne correspond.
          </Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Compte</TableCell>
                  <TableCell>Téléphone</TableCell>
                  <TableCell>Rôle</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.userId}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {u.fullName ?? "—"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {u.email}
                      </Typography>
                    </TableCell>
                    <TableCell>{u.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={u.role} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={u.active ? "success" : "default"}
                        label={u.active ? "Actif" : "Désactivé"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" sx={{ gap: 1, justifyContent: "flex-end" }}>
                        <Button
                          size="small"
                          startIcon={<KeyRound size={14} />}
                          onClick={() => onReset(u)}
                        >
                          Réinitialiser
                        </Button>
                        <Button
                          size="small"
                          startIcon={<LifeBuoy size={14} />}
                          onClick={() => onSupport(u)}
                          disabled={!u.active || u.role === "ADMIN"}
                        >
                          Mode support
                        </Button>
                        <Button
                          size="small"
                          color={u.active ? "error" : "primary"}
                          onClick={() =>
                            u.active
                              ? void onDeactivate(u)
                              : void setActive({ userId: u.userId, active: true })
                          }
                        >
                          {u.active ? "Désactiver" : "Réactiver"}
                        </Button>
                        <Button
                          size="small"
                          startIcon={<LogOut size={14} />}
                          onClick={() => void onCutSessions(u)}
                          disabled={!u.active}
                        >
                          Couper les sessions
                        </Button>
                        {canAnonymize && (
                          <Button
                            size="small"
                            color="error"
                            disabled={u.role === "ADMIN"}
                            onClick={() => {
                              setConfirmEmail("");
                              setAnonymizeError(null);
                              setToAnonymize(u);
                            }}
                          >
                            Anonymiser
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </CardContent>

      {/* A dialog, not a toast: this password is shown once and must be copied before it is lost. */}
      <Dialog open={issued !== null} onClose={() => setIssued(null)} fullWidth maxWidth="xs">
        <DialogTitle>Mot de passe temporaire</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Affiché une seule fois. Transmettez-le maintenant à {issued?.email}.
          </Alert>
          <Typography
            sx={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", fontWeight: 700, userSelect: "all" }}
          >
            {issued?.password}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (issued) navigator.clipboard?.writeText(issued.password);
            }}
          >
            Copier
          </Button>
          <Button variant="contained" onClick={() => setIssued(null)}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>
      {/* The action this whole screen exists to make possible, and the one that cannot be undone:
          the address is typed back rather than clicked twice. */}
      <Dialog open={toAnonymize !== null} onClose={closeAnonymize} fullWidth maxWidth="xs">
        <DialogTitle>Anonymiser ce compte</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            Irréversible. Le nom, l&apos;adresse et le téléphone de {toAnonymize?.email} sont
            effacés définitivement. Les données de ferme qu&apos;il a saisies restent en place.
          </Alert>
          {anonymizeError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {anonymizeError}
            </Alert>
          )}
          <Typography variant="body2" sx={{ mb: 1 }}>
            Saisissez <strong>{toAnonymize?.email}</strong> pour confirmer.
          </Typography>
          <TextField
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder={toAnonymize?.email ?? ""}
            slotProps={{ htmlInput: { "aria-label": "Confirmer l'adresse" } }}
            fullWidth
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAnonymize}>Annuler</Button>
          <Button
            variant="contained"
            color="error"
            disabled={anonymizing || confirmEmail.trim() !== toAnonymize?.email}
            onClick={onAnonymize}
          >
            Anonymiser
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
