"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, Box, Button, CircularProgress, Stack } from "@mui/material";
import { KeyRound } from "lucide-react";
import { useChangePasswordMutation } from "@/store/api/authApi";
import { PasswordField } from "@/components/forms/PasswordField";
import { apiErrorMessage } from "@/lib/apiError";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: z.string().min(8, "8 caractères minimum"),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ["confirm"],
    message: "Les deux mots de passe ne correspondent pas",
  });

type FormValues = z.infer<typeof schema>;

/**
 * Change your own password, wherever you are signed in.
 *
 * Shared between the farmer app and the console because the endpoint and the consequence are the
 * same; only what happens afterwards differs — each surface clears its own token store, which is
 * why {@code onChanged} is a callback rather than a redirect baked in here.
 */
export function ChangePasswordForm({ onChanged }: { onChanged: () => void }) {
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }).unwrap();
      setDone(true);
      onChanged();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  if (done) {
    return (
      <Alert severity="success">
        Mot de passe modifié. Vos sessions ont été fermées — reconnexion…
      </Alert>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack spacing={2.5}>
        {error && <Alert severity="error">{error}</Alert>}
        <Controller
          name="currentPassword"
          control={control}
          render={({ field, fieldState }) => (
            <PasswordField
              {...field}
              label="Mot de passe actuel"
              autoComplete="current-password"
              fullWidth
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
            />
          )}
        />
        <Controller
          name="newPassword"
          control={control}
          render={({ field, fieldState }) => (
            <PasswordField
              {...field}
              label="Nouveau mot de passe"
              autoComplete="new-password"
              fullWidth
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
            />
          )}
        />
        <Controller
          name="confirm"
          control={control}
          render={({ field, fieldState }) => (
            <PasswordField
              {...field}
              label="Confirmer"
              autoComplete="new-password"
              fullWidth
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
            />
          )}
        />
        <Alert severity="info">
          Toutes vos sessions seront fermées, y compris celle-ci. Vous devrez vous reconnecter.
        </Alert>
        <Button
          type="submit"
          variant="contained"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : <KeyRound size={16} />}
          sx={{ alignSelf: "flex-start" }}
        >
          Changer mon mot de passe
        </Button>
      </Stack>
    </Box>
  );
}
