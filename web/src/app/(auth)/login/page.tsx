"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowRight, Mail } from "lucide-react";
import { useLoginMutation } from "@/store/api/authApi";
import { PhoneField } from "@/components/PhoneField";

/**
 * Which kind of identifier the person is typing.
 *
 * The server accepts either, but the SCREEN must know: a phone field needs a country picker and
 * an address does not. Without the choice the field can only guess a country — and a Beninese
 * worker typing 01 56 34 34 08 would be looked up as +221156343408, which is nobody.
 */
type IdentifierMode = "email" | "phone";
import { useAppDispatch } from "@/store/hooks";
import { setTokens } from "@/store/slices/authSlice";
import { apiErrorMessage } from "@/lib/apiError";
import { PasswordField } from "@/components/forms/PasswordField";

const loginSchema = z.object({
  // An address or a phone number: the backend resolves either since 2026-10-08. No shape
  // check here — refusing a number that the server would have accepted is the worse error.
  email: z.string().min(1, "Identifiant requis"),
  password: z.string().min(1, "Mot de passe requis"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useLoginMutation();
  const [serverError, setServerError] = useState<string | null>(null);

  const [mode, setMode] = useState<IdentifierMode>("email");

  const { control, handleSubmit, setValue } = useForm<LoginForm>({
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
          Bienvenue
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Veuillez entrer vos identifiants pour accéder à votre exploitation.
        </Typography>
      </Box>

      {serverError && <Alert severity="error">{serverError}</Alert>}

      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5}>
          {/* Two tabs rather than a dropdown: one click instead of two. */}
          <ToggleButtonGroup
            value={mode}
            exclusive
            fullWidth
            size="small"
            onChange={(_, next: IdentifierMode | null) => {
              if (!next) return;
              setMode(next);
              // An address and a number share nothing: carrying one over as the other would
              // leave half an address sitting in a phone field.
              setValue("email", "");
            }}
            aria-label="Type d'identifiant"
          >
            <ToggleButton value="email" aria-label="Identifiant par e-mail">
              E-mail
            </ToggleButton>
            <ToggleButton value="phone" aria-label="Identifiant par numéro">
              Numéro
            </ToggleButton>
          </ToggleButtonGroup>

          <Controller
            name="email"
            control={control}
            render={({ field, fieldState }) =>
              mode === "phone" ? (
                <PhoneField
                  value={field.value}
                  onChange={field.onChange}
                  label="Numéro de téléphone"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              ) : (
                <TextField
                  {...field}
                  label="Adresse e-mail"
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
              )
            }
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

          <Box sx={{ textAlign: "right" }}>
            <Link href="/forgot-password" style={{ fontWeight: 600 }}>
              Mot de passe oublié ?
            </Link>
          </Box>

          <Button
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            disabled={isLoading}
            endIcon={!isLoading ? <ArrowRight size={18} /> : null}
            startIcon={
              isLoading ? <CircularProgress size={18} color="inherit" /> : null
            }
            sx={{ height: 48 }}
          >
            Se connecter
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}
