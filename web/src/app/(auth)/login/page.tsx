"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useLoginMutation } from "@/store/api/authApi";
import { useAppDispatch } from "@/store/hooks";
import { setTokens } from "@/store/slices/authSlice";
import { apiErrorMessage } from "@/lib/apiError";

const loginSchema = z.object({
  email: z.email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useLoginMutation();
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      const tokens = await login(values).unwrap();
      dispatch(setTokens(tokens));
      router.replace("/dashboard");
    } catch (err) {
      setServerError(apiErrorMessage(err));
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          Connexion
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Accédez à votre espace AviCare.
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
              />
            )}
          />
          <Controller
            name="password"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Mot de passe"
                type="password"
                autoComplete="current-password"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Typography variant="caption" color="text.secondary">
            Mot de passe oublié ? (bientôt disponible)
          </Typography>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            disabled={isLoading}
            startIcon={
              isLoading ? <CircularProgress size={18} color="inherit" /> : null
            }
          >
            Se connecter
          </Button>
        </Stack>
      </Box>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: "center" }}
      >
        Pas encore de compte ?{" "}
        <Link href="/signup" style={{ fontWeight: 600 }}>
          Créer un compte
        </Link>
      </Typography>
    </Stack>
  );
}
