"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import { useInviteMemberMutation } from "@/store/api/membersApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { FARM_ROLES, FARM_ROLE_LABELS } from "@/constants/farmRoles";

const inviteSchema = z.object({
  email: z.email("Adresse e-mail invalide"),
  role: z.enum(["OWNER", "MANAGER", "FARMER", "VETERINARIAN", "BUYER"]),
});

type InviteForm = z.infer<typeof inviteSchema>;

interface InviteMemberDialogProps {
  open: boolean;
  onClose: () => void;
  farmId: number;
}

/**
 * Invite an existing user onto a farm by email + role (A6-2 step 4.7). Mirrors
 * the backend AddMemberRequest contract. The invited user must already have an
 * account — the backend resolves them by email.
 */
export function InviteMemberDialog({
  open,
  onClose,
  farmId,
}: InviteMemberDialogProps) {
  const { showToast } = useToast();
  const [inviteMember, { isLoading }] = useInviteMemberMutation();

  const { control, handleSubmit, reset } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "FARMER" },
  });

  useEffect(() => {
    if (open) reset({ email: "", role: "FARMER" });
  }, [open, reset]);

  const onSubmit = async (values: InviteForm) => {
    try {
      await inviteMember({ farmId, body: values }).unwrap();
      showToast("Membre invité avec succès.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle sx={{ pr: 6 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Inviter un membre
          </Typography>
          <Typography variant="body2" color="text.secondary">
            L&apos;utilisateur doit déjà disposer d&apos;un compte AviCare.
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
            <Controller
              name="email"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Adresse e-mail"
                  type="email"
                  placeholder="membre@exemple.com"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="role"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  select
                  label="Rôle"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                >
                  {FARM_ROLES.map((role) => (
                    <MenuItem key={role} value={role}>
                      {FARM_ROLE_LABELS[role]}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} color="inherit">
            Annuler
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={isLoading}
            startIcon={
              isLoading ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            Envoyer l&apos;invitation
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
