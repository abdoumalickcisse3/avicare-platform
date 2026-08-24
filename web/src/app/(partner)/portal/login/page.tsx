"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowRight, Handshake, Mail } from "lucide-react";
import { usePartnerLoginMutation } from "@/store/api/partnerApi";
import { partnerTokenStorage } from "@/lib/partnerStorage";
import { PasswordField } from "@/components/forms/PasswordField";
import { colors } from "@/theme/tokens";

const loginSchema = z.object({
  email: z.email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function PartnerLoginPage() {
  const router = useRouter();
  const [login, { isLoading }] = usePartnerLoginMutation();
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      const tokens = await login(values).unwrap();
      partnerTokenStorage.set(tokens.accessToken, tokens.refreshToken);
      router.replace("/portal");
    } catch {
      setServerError("Identifiants invalides ou compte inactif.");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Stack spacing={3} sx={{ width: "100%", maxWidth: 420 }}>
        <Box sx={{ textAlign: "center" }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              mx: "auto",
              mb: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: colors.primary[50],
              color: colors.primary[600],
            }}
          >
            <Handshake size={28} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Portail partenaire
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Connectez-vous pour suivre votre réseau d&apos;éleveurs.
          </Typography>
        </Box>

        {serverError && <Alert severity="error">{serverError}</Alert>}

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5}>
            <Controller
              name="email"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Adresse e-mail"
                  type="email"
                  autoComplete="email"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Mail size={18} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              )}
            />
            <Controller
              name="password"
              control={control}
              render={({ field, fieldState }) => (
                <PasswordField
                  {...field}
                  label="Mot de passe"
                  autoComplete="current-password"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              disabled={isLoading}
              endIcon={!isLoading ? <ArrowRight size={18} /> : null}
              startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : null}
              sx={{ height: 48 }}
            >
              Se connecter
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
