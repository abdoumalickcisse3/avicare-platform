"use client";

import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  Button,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { useToast } from "@/components/feedback/ToastProvider";

const forgotSchema = z.object({
  email: z.email("Adresse e-mail invalide"),
});

type ForgotForm = z.infer<typeof forgotSchema>;

/**
 * Placeholder password-reset page (A6-2 step 4.3). The backend reset flow does
 * not exist yet, so submitting only confirms via a toast. Layout matches the
 * Stitch "Mot de passe oublié" design.
 */
export default function ForgotPasswordPage() {
  const { showToast } = useToast();
  const { control, handleSubmit, reset } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = () => {
    showToast("Fonctionnalité disponible prochainement.", "info");
    reset();
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          Mot de passe oublié ?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Entrez votre e-mail pour recevoir un lien de réinitialisation.
        </Typography>
      </Box>

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
          <Button
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            endIcon={<ArrowRight size={18} />}
            sx={{ height: 48 }}
          >
            Envoyer le lien
          </Button>
        </Stack>
      </Box>

      <Box sx={{ textAlign: "center" }}>
        <Link
          href="/login"
          style={{
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ArrowLeft size={16} />
          Retour à la connexion
        </Link>
      </Box>
    </Stack>
  );
}
