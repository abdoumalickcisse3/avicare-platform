"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUpdateProfileMutation } from "@/store/api/authApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setCurrentUser } from "@/store/slices/authSlice";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { logout } from "@/store/authActions";
import { colors } from "@/theme/tokens";

const schema = z.object({
  fullName: z.string().min(1, "Nom requis").max(200, "200 caractères maximum"),
  phone: z
    .string()
    .max(30, "30 caractères maximum")
    .optional()
    .or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

/** Edit the signed-in user's own profile (name + phone). The phone feeds WhatsApp alerts. */
export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const user = useAppSelector((s) => s.auth.currentUser);
  const { showToast } = useToast();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", phone: "" },
  });

  // Edge-triggered reset when the dialog opens, seeded from the current user.
  useEffect(() => {
    if (open) {
      reset({ fullName: user?.fullName ?? "", phone: user?.phone ?? "" });
      setTab(0);
    }
  }, [open, user, reset]);

  // The server revoked every refresh token, this one included — staying here would leave a shell
  // running on a session that can no longer be renewed.
  const onPasswordChanged = () => {
    setTimeout(() => {
      dispatch(logout());
      router.replace("/login");
    }, 1800);
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const updated = await updateProfile({
        fullName: values.fullName,
        phone: values.phone ? values.phone : undefined,
      }).unwrap();
      dispatch(setCurrentUser(updated));
      showToast("Profil mis à jour", "success");
      onClose();
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ flex: 1, fontWeight: 700 }}>Mon profil</Box>
        <IconButton onClick={onClose} aria-label="Fermer" size="small">
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3 }}>
        <Tab label="Profil" />
        <Tab label="Mot de passe" />
      </Tabs>
      {/* Two panels rather than one form: a password form nested inside the profile form would be
          invalid HTML, and submitting one would carry the other. */}
      {tab === 1 ? (
        <DialogContent>
          <ChangePasswordForm onChanged={onPasswordChanged} />
        </DialogContent>
      ) : (
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" sx={{ color: colors.neutral[500] }}>
                Email
              </Typography>
              <Typography sx={{ fontWeight: 600 }}>{user?.email ?? "—"}</Typography>
            </Box>
            <Controller
              name="fullName"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Nom complet"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="phone"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Téléphone (WhatsApp)"
                  type="tel"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={
                    fieldState.error?.message ??
                    "Alertes WhatsApp — et seule façon de récupérer un mot de passe perdu. Ex : 221770000000"
                  }
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="contained" disabled={isLoading}>
            {isLoading ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogActions>
      </form>
      )}
    </Dialog>
  );
}
