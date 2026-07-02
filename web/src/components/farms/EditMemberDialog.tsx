"use client";

import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import {
  useUpdateMemberMutation,
  useResetMemberPasswordMutation,
  useRemoveMemberMutation,
} from "@/store/api/membersApi";
import { useGetPermissionCatalogQuery } from "@/store/api/permissionsApi";
import { PermissionEditor } from "./PermissionEditor";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { colors } from "@/theme/tokens";
import { ASSIGNABLE_FARM_ROLES, FARM_ROLE_LABELS } from "@/constants/farmRoles";
import type { FarmRole, Member } from "@/types";

interface EditMemberDialogProps {
  open: boolean;
  onClose: () => void;
  farmId: number;
  member: Member;
}

function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/**
 * Edits an existing member's role, permissions and account status, plus
 * password reset / removal from the farm (Task 9, design Stitch 8d615c93).
 */
export function EditMemberDialog({ open, onClose, farmId, member }: EditMemberDialogProps) {
  const { showToast } = useToast();
  const [updateMember, { isLoading }] = useUpdateMemberMutation();
  const [resetPassword, { isLoading: resetLoading }] = useResetMemberPasswordMutation();
  const [removeMember, { isLoading: removeLoading }] = useRemoveMemberMutation();
  const { data: catalog } = useGetPermissionCatalogQuery();

  const [role, setRole] = useState<FarmRole>(member.role);
  const [permissions, setPermissions] = useState<string[]>(member.permissions);
  const [active, setActive] = useState(member.active);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  // Render-phase reset (per React docs "you might not need an effect"): whenever
  // the dialog transitions closed->open, or a different member is swapped in
  // while it stays open, reload local state from the latest member snapshot.
  // Tracking `wasOpen` (edge-triggered) rather than a combined key ensures a
  // reopen of the SAME member always reseeds, discarding unsaved edits.
  const [wasOpen, setWasOpen] = useState(false);
  const [seededUserId, setSeededUserId] = useState<number | null>(null);

  const reseed = () => {
    setRole(member.role);
    setPermissions(member.permissions);
    setActive(member.active);
    setTemporaryPassword(null);
    setSeededUserId(member.userId);
  };

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) reseed();
  }
  if (open && seededUserId !== member.userId) {
    reseed();
  }

  const handleRoleChange = (next: FarmRole) => {
    setRole(next);
    if (catalog) {
      setPermissions(catalog.roleDefaults[next] ?? []);
    }
  };

  const handleResetToDefaults = () => {
    if (catalog) {
      setPermissions(catalog.roleDefaults[role] ?? []);
    }
  };

  const handleResetPassword = async () => {
    try {
      const result = await resetPassword({ farmId, userId: member.userId }).unwrap();
      setTemporaryPassword(result.temporaryPassword);
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const handleRemove = async () => {
    try {
      await removeMember({ farmId, userId: member.userId }).unwrap();
      setConfirmRemoveOpen(false);
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const handleSave = async () => {
    try {
      await updateMember({ farmId, userId: member.userId, role, permissions, active }).unwrap();
      showToast("Membre mis à jour avec succès.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="sm"
        slotProps={{ paper: { sx: { borderRadius: `${16}px` } } }}
      >
        <DialogTitle component="div" sx={{ pr: 6 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Modifier le membre
          </Typography>
          <IconButton
            onClick={onClose}
            aria-label="Fermer"
            sx={{ position: "absolute", top: 12, right: 12 }}
          >
            <X size={20} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Avatar
                sx={{
                  bgcolor: colors.primary[50],
                  color: colors.primary[600],
                  width: 48,
                  height: 48,
                  fontWeight: 700,
                }}
              >
                {initials(member.fullName)}
              </Avatar>
              <Stack spacing={0.25}>
                <Typography sx={{ fontWeight: 700 }}>{member.fullName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {member.email}
                  {member.phone ? ` · ${member.phone}` : ""}
                </Typography>
              </Stack>
            </Stack>

            <TextField
              select
              label="Rôle"
              fullWidth
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as FarmRole)}
            >
              {member.role === "OWNER" && (
                <MenuItem value="OWNER" disabled>
                  {FARM_ROLE_LABELS.OWNER}
                </MenuItem>
              )}
              {ASSIGNABLE_FARM_ROLES.map((r) => (
                <MenuItem key={r} value={r}>
                  {FARM_ROLE_LABELS[r]}
                </MenuItem>
              ))}
            </TextField>

            <Button
              onClick={handleResetToDefaults}
              disabled={!catalog}
              sx={{ alignSelf: "flex-start", textTransform: "none" }}
            >
              Réinitialiser aux accès par défaut du rôle
            </Button>

            {catalog && (
              <PermissionEditor catalog={catalog} value={permissions} onChange={setPermissions} />
            )}

            <Divider />

            <Stack spacing={1.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Compte
              </Typography>

              <Button
                variant="outlined"
                onClick={handleResetPassword}
                disabled={resetLoading}
                startIcon={
                  resetLoading ? <CircularProgress size={16} color="inherit" /> : null
                }
                sx={{ alignSelf: "flex-start" }}
              >
                Réinitialiser le mot de passe
              </Button>

              {temporaryPassword && (
                <Stack spacing={0.5}>
                  <Alert severity="success">
                    Mot de passe temporaire : <strong>{temporaryPassword}</strong>
                  </Alert>
                  <Typography variant="caption" color="text.secondary">
                    Notez-le, il ne sera plus affiché.
                  </Typography>
                </Stack>
              )}

              <FormControlLabel
                control={
                  <Switch
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                }
                label="Compte actif"
              />
            </Stack>

            <Divider />

            <Box>
              <Button
                color="error"
                onClick={() => setConfirmRemoveOpen(true)}
                sx={{ textTransform: "none" }}
              >
                Retirer de la ferme
              </Button>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} color="inherit">
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              bgcolor: colors.accent[400],
              "&:hover": { bgcolor: colors.accent[500] },
            }}
          >
            Enregistrer les modifications
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmRemoveOpen}
        title="Retirer ce membre de la ferme ?"
        message={`${member.fullName} perdra l'accès à cette ferme. Cette action est irréversible.`}
        confirmLabel="Retirer"
        danger
        loading={removeLoading}
        onConfirm={handleRemove}
        onClose={() => setConfirmRemoveOpen(false)}
      />
    </>
  );
}
