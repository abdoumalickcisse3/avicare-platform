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
import { useSignupMutation } from "@/store/api/authApi";
import { useAppDispatch } from "@/store/hooks";
import { setTokens } from "@/store/slices/authSlice";
import { apiErrorMessage } from "@/lib/apiError";

const signupSchema = z.object({
  fullName: z.string().min(1, "Nom complet requis"),
  email: z.email("Adresse e-mail invalide"),
  password: z.string().min(8, "8 caractères minimum"),
  phone: z
    .string()
    .max(30, "30 caractères maximum")
    .optional()
    .or(z.literal("")),
});

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [signup, { isLoading }] = useSignupMutation();
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "", phone: "" },
  });

  const onSubmit = async (values: SignupForm) => {
    setServerError(null);
    try {
      const tokens = await signup({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        phone: values.phone ? values.phone : undefined,
      }).unwrap();
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
          Créer un compte
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Quelques informations pour démarrer.
        </Typography>
      </Box>

      {serverError && <Alert severity="error">{serverError}</Alert>}

      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5}>
          <Controller
            name="fullName"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Nom complet"
                autoComplete="name"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
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
                autoComplete="new-password"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? "8 caractères minimum"}
              />
            )}
          />
          <Controller
            name="phone"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Téléphone (optionnel)"
                type="tel"
                autoComplete="tel"
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
            startIcon={
              isLoading ? <CircularProgress size={18} color="inherit" /> : null
            }
          >
            Créer mon compte
          </Button>
        </Stack>
      </Box>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: "center" }}
      >
        Déjà inscrit ?{" "}
        <Link href="/login" style={{ fontWeight: 600 }}>
          Se connecter
        </Link>
      </Typography>
    </Stack>
  );
}
