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
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowLeft, ArrowRight, MessageCircle, Phone } from "lucide-react";
import {
  useConfirmPasswordResetMutation,
  useRequestPasswordResetMutation,
} from "@/store/api/authApi";
import { PasswordField } from "@/components/forms/PasswordField";
import { apiErrorMessage } from "@/lib/apiError";

const phoneSchema = z.object({
  phone: z.string().min(6, "Numéro de téléphone requis"),
});
const codeSchema = z.object({
  code: z.string().length(6, "Le code fait 6 chiffres"),
  newPassword: z.string().min(8, "8 caractères minimum"),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type CodeForm = z.infer<typeof codeSchema>;

/**
 * Password reset over WhatsApp, in two steps.
 *
 * <p>WhatsApp rather than email: that is how the audience communicates, and the platform has no
 * SMTP. A farmer whose account has no phone number is not stranded — support resets it from the
 * back-office — and the screen says so rather than leaving them guessing.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [requestCode, { isLoading: sending }] = useRequestPasswordResetMutation();
  const [confirmReset, { isLoading: confirming }] = useConfirmPasswordResetMutation();

  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });
  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "", newPassword: "" },
  });

  const onRequest = async (values: PhoneForm) => {
    setError(null);
    await requestCode({ phone: values.phone }).unwrap().catch(() => {});
    // Move on whatever happened: the server answers the same for a known and an unknown number,
    // and so must this screen.
    setPhone(values.phone);
  };

  const onConfirm = async (values: CodeForm) => {
    setError(null);
    try {
      await confirmReset({ phone: phone as string, ...values }).unwrap();
      setDone(true);
      setTimeout(() => router.replace("/login"), 1500);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  if (done) {
    return (
      <Stack spacing={3}>
        <Alert severity="success">
          Mot de passe modifié. Redirection vers la connexion…
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          Mot de passe oublié ?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {phone === null
            ? "Entrez votre numéro : vous recevrez un code par WhatsApp."
            : `Entrez le code reçu par WhatsApp au ${phone}.`}
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {phone === null ? (
        <Box component="form" onSubmit={phoneForm.handleSubmit(onRequest)} noValidate>
          <Stack spacing={2.5}>
            <Controller
              name="phone"
              control={phoneForm.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Numéro de téléphone"
                  type="tel"
                  autoComplete="tel"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Phone size={18} />
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
              size="large"
              fullWidth
              disabled={sending}
              endIcon={!sending ? <MessageCircle size={18} /> : null}
              startIcon={sending ? <CircularProgress size={18} color="inherit" /> : null}
              sx={{ height: 48 }}
            >
              Recevoir un code
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box component="form" onSubmit={codeForm.handleSubmit(onConfirm)} noValidate>
          <Stack spacing={2.5}>
            <Alert severity="info">
              Si un compte est associé à ce numéro, le code vient d&apos;être envoyé. Il est valable
              15 minutes.
            </Alert>
            <Controller
              name="code"
              control={codeForm.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Code à 6 chiffres"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 6 } }}
                />
              )}
            />
            <Controller
              name="newPassword"
              control={codeForm.control}
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
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={confirming}
              endIcon={!confirming ? <ArrowRight size={18} /> : null}
              startIcon={confirming ? <CircularProgress size={18} color="inherit" /> : null}
              sx={{ height: 48 }}
            >
              Changer mon mot de passe
            </Button>
            <Button variant="text" size="small" onClick={() => setPhone(null)}>
              Changer de numéro
            </Button>
          </Stack>
        </Box>
      )}

      <Typography variant="caption" color="text.secondary">
        Pas de numéro enregistré sur votre compte ? Contactez le support : seul un administrateur
        peut réinitialiser votre accès.
      </Typography>

      <Button component={Link} href="/login" startIcon={<ArrowLeft size={16} />} size="small">
        Retour à la connexion
      </Button>
    </Stack>
  );
}
