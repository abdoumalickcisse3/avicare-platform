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
import { KeyRound, LifeBuoy, Search } from "lucide-react";
import {
  useImpersonateMutation,
  useLazySearchAdminUsersQuery,
  useResetAdminUserPasswordMutation,
  useSetAdminUserActiveMutation,
} from "@/store/api/adminApi";
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
  const [openSupport] = useImpersonateMutation();
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

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
                          onClick={() => setActive({ userId: u.userId, active: !u.active })}
                        >
                          {u.active ? "Désactiver" : "Réactiver"}
                        </Button>
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
    </Card>
  );
}
