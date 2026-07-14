"use client";

import { useEffect, useRef, useState } from "react";
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
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useSignupMutation } from "@/store/api/authApi";
import { useCreateFarmMutation } from "@/store/api/farmsApi";
import {
  ONBOARDING_SETTING_KEY,
  useUpsertSettingMutation,
} from "@/store/api/accountSettingsApi";
import { useAppDispatch } from "@/store/hooks";
import { setTokens } from "@/store/slices/authSlice";
import { hasAccessToken } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/apiError";
import { useRefreshSession } from "@/hooks/useRefreshSession";
import { PasswordField } from "@/components/forms/PasswordField";

const signupSchema = z
  .object({
    firstName: z.string().min(1, "Prénom requis"),
    lastName: z.string().min(1, "Nom requis"),
    email: z.email("Adresse e-mail invalide"),
    phone: z.string().max(30, "30 caractères maximum").optional().or(z.literal("")),
    password: z.string().min(8, "8 caractères minimum"),
    confirmPassword: z.string().min(1, "Veuillez confirmer le mot de passe"),
    farmName: z.string().min(1, "Nom de la ferme requis").max(200, "200 caractères maximum"),
    location: z.string().max(500, "500 caractères maximum").optional().or(z.literal("")),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const refreshSession = useRefreshSession();

  const [signup] = useSignupMutation();
  const [createFarm] = useCreateFarmMutation();
  const [upsertSetting] = useUpsertSettingMutation();

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Retry-safe orchestration progress (survives re-clicks without re-signing-up
  // or re-creating the farm).
  const orch = useRef<{ signedUp: boolean; farmId: number | null }>({
    signedUp: false,
    farmId: null,
  });

  // Already authenticated → no need to sign up again.
  useEffect(() => {
    if (hasAccessToken()) router.replace("/dashboard");
  }, [router]);

  const { control, trigger, getValues } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    shouldUnregister: false,
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      farmName: "",
      location: "",
    },
  });

  const onSubmit = async () => {
    const valid = await trigger();
    if (!valid) return;
    await handleCreate();
  };

  const handleCreate = async () => {
    const v = getValues();
    setServerError(null);
    setSubmitting(true);
    try {
      // a. Account (once).
      if (!orch.current.signedUp) {
        const tokens = await signup({
          fullName: `${v.firstName} ${v.lastName}`.trim(),
          email: v.email,
          password: v.password,
          phone: v.phone ? v.phone : undefined,
        }).unwrap();
        dispatch(setTokens(tokens));
        orch.current.signedUp = true;
      }
      // b. Farm (once) — signup does not create one. The farm is auto-provisioned
      // server-side with all V1 modules. Refresh so the token carries the new
      // OWNER membership.
      if (!orch.current.farmId) {
        const farm = await createFarm({
          name: v.farmName.trim(),
          location: v.location?.trim() || undefined,
        }).unwrap();
        orch.current.farmId = farm.id;
        await refreshSession();
      }
      // c. Mark onboarding (account + farm) done.
      await upsertSetting({
        key: ONBOARDING_SETTING_KEY,
        value: { completed: true },
      }).unwrap();

      router.replace("/dashboard");
    } catch (err) {
      setServerError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          Créer votre compte
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Rejoignez l&apos;élite de l&apos;aviculture moderne au Sénégal.
        </Typography>
      </Box>

      {serverError && <Alert severity="error">{serverError}</Alert>}

      <Stack spacing={2.5}>
        <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
          <Controller
            name="firstName"
            control={control}
            render={({ field, fieldState }) => (
              <TextField {...field} label="Prénom" autoComplete="given-name" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} />
            )}
          />
          <Controller
            name="lastName"
            control={control}
            render={({ field, fieldState }) => (
              <TextField {...field} label="Nom" autoComplete="family-name" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} />
            )}
          />
        </Box>
        <Controller
          name="email"
          control={control}
          render={({ field, fieldState }) => (
            <TextField {...field} label="Adresse e-mail" type="email" autoComplete="email" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} />
          )}
        />
        <Controller
          name="phone"
          control={control}
          render={({ field, fieldState }) => (
            <TextField {...field} label="Téléphone (optionnel)" type="tel" autoComplete="tel" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} />
          )}
        />
        <Controller
          name="password"
          control={control}
          render={({ field, fieldState }) => (
            <PasswordField {...field} label="Mot de passe" autoComplete="new-password" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message ?? "8 caractères minimum"} />
          )}
        />
        <Controller
          name="confirmPassword"
          control={control}
          render={({ field, fieldState }) => (
            <PasswordField {...field} label="Confirmation" autoComplete="new-password" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} />
          )}
        />

        <Divider>Votre ferme</Divider>

        <Controller
          name="farmName"
          control={control}
          render={({ field, fieldState }) => (
            <TextField {...field} label="Nom de la ferme" placeholder="Ex : Ferme Avicole du Saloum" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} />
          )}
        />
        <Controller
          name="location"
          control={control}
          render={({ field, fieldState }) => (
            <TextField {...field} label="Localisation (optionnel)" placeholder="Ex : Thiès, Sénégal" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} />
          )}
        />

        <Button
          variant="contained"
          color="primary"
          size="large"
          fullWidth
          disabled={submitting}
          endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
          onClick={onSubmit}
          sx={{ height: 48 }}
        >
          Créer mon compte
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
        Déjà inscrit ?{" "}
        <Link href="/login" style={{ fontWeight: 600 }}>
          Se connecter
        </Link>
      </Typography>
    </Stack>
  );
}
