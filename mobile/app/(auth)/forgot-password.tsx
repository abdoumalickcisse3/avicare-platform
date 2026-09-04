/**
 * Mot de passe oublié — two steps over WhatsApp, mirroring the web screen and the backend's
 * /auth/password-reset endpoints: a phone number gets a six-digit code, the code plus a new
 * password sets it.
 *
 * WhatsApp rather than e-mail because that is how the audience communicates and the platform has
 * no SMTP. A farmer whose account carries no number is not stranded — support resets it from the
 * back-office — and the screen says so instead of leaving them guessing.
 *
 * The confirmation after step 1 is deliberately non-committal: the server answers the same for a
 * known and an unknown number, and so does this screen, or it becomes a way to test whether an
 * account exists.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { tokens } from '@/theme';
import {
  useConfirmPasswordResetMutation,
  useRequestPasswordResetMutation,
} from '@/store/api/authApi';

const phoneSchema = z.object({
  phone: z.string().min(6, 'Numéro de téléphone requis'),
});
const codeSchema = z.object({
  code: z.string().length(6, 'Le code fait 6 chiffres'),
  newPassword: z.string().min(8, '8 caractères minimum'),
});

type PhoneValues = z.infer<typeof phoneSchema>;
type CodeValues = z.infer<typeof codeSchema>;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [requestCode, { isLoading: sending }] = useRequestPasswordResetMutation();
  const [confirmReset, { isLoading: confirming }] = useConfirmPasswordResetMutation();

  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const phoneForm = useForm<PhoneValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });
  const codeForm = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '', newPassword: '' },
  });

  const onRequest = async (v: PhoneValues) => {
    setError(null);
    try {
      await requestCode({ phone: v.phone }).unwrap();
    } catch {
      // Deliberately swallowed: an unknown number must look exactly like a known one.
    }
    setPhone(v.phone);
  };

  const onConfirm = async (v: CodeValues) => {
    setError(null);
    try {
      await confirmReset({ phone: phone as string, ...v }).unwrap();
      setDone(true);
    } catch {
      setError('Code incorrect ou expiré. Demandez-en un nouveau.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <ArrowLeft size={24} color={tokens.colors.field.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {done ? (
            <View style={styles.doneBox}>
              <View style={styles.doneDisc}>
                <CheckCircle2 size={32} color={tokens.colors.primary[600]} />
              </View>
              <Text style={styles.title}>Mot de passe modifié</Text>
              <Text style={styles.text}>
                Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
              </Text>
              <Pressable
                style={styles.cta}
                onPress={() => router.replace('/(auth)/login')}
                accessibilityRole="button"
              >
                <Text style={styles.ctaText}>Retour à la connexion</Text>
              </Pressable>
            </View>
          ) : phone === null ? (
            <>
              <Text style={styles.title}>Mot de passe oublié</Text>
              <Text style={styles.text}>
                Saisissez votre numéro de téléphone. Vous recevrez un code par WhatsApp.
              </Text>

              <View style={styles.field}>
                <Text style={styles.label}>Numéro de téléphone</Text>
                <Controller
                  control={phoneForm.control}
                  name="phone"
                  render={({ field: { onBlur, onChange, value } }) => (
                    <TextInput
                      style={[
                        styles.input,
                        phoneForm.formState.errors.phone && styles.inputError,
                      ]}
                      accessibilityLabel="Numéro de téléphone"
                      placeholder="+221 77 000 00 00"
                      placeholderTextColor={tokens.colors.field.disabled}
                      autoCapitalize="none"
                      autoComplete="tel"
                      keyboardType="phone-pad"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                  )}
                />
                {phoneForm.formState.errors.phone ? (
                  <Text style={styles.error}>{phoneForm.formState.errors.phone.message}</Text>
                ) : null}
              </View>

              <Pressable
                style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
                onPress={phoneForm.handleSubmit(onRequest)}
                disabled={sending}
                accessibilityRole="button"
                accessibilityLabel="Recevoir un code"
              >
                {sending ? (
                  <ActivityIndicator color={tokens.colors.earth} />
                ) : (
                  <Text style={styles.ctaText}>Recevoir un code</Text>
                )}
              </Pressable>

              <Text style={styles.footnote}>
                Pas de numéro enregistré sur votre compte ? Contactez le support : seul un
                administrateur peut réinitialiser votre accès.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Entrez le code</Text>
              <Text style={styles.text}>
                Si un compte est associé au {phone}, le code vient d&apos;être envoyé sur WhatsApp.
                Il est valable 15 minutes.
              </Text>

              {error ? <Text style={styles.serverError}>{error}</Text> : null}

              <View style={styles.field}>
                <Text style={styles.label}>Code à 6 chiffres</Text>
                <Controller
                  control={codeForm.control}
                  name="code"
                  render={({ field: { onBlur, onChange, value } }) => (
                    <TextInput
                      style={[styles.input, codeForm.formState.errors.code && styles.inputError]}
                      accessibilityLabel="Code à 6 chiffres"
                      placeholder="123456"
                      placeholderTextColor={tokens.colors.field.disabled}
                      keyboardType="number-pad"
                      maxLength={6}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                  )}
                />
                {codeForm.formState.errors.code ? (
                  <Text style={styles.error}>{codeForm.formState.errors.code.message}</Text>
                ) : null}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Nouveau mot de passe</Text>
                <Controller
                  control={codeForm.control}
                  name="newPassword"
                  render={({ field: { onBlur, onChange, value } }) => (
                    <TextInput
                      style={[
                        styles.input,
                        codeForm.formState.errors.newPassword && styles.inputError,
                      ]}
                      accessibilityLabel="Nouveau mot de passe"
                      placeholder="8 caractères minimum"
                      placeholderTextColor={tokens.colors.field.disabled}
                      autoCapitalize="none"
                      secureTextEntry
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                  )}
                />
                {codeForm.formState.errors.newPassword ? (
                  <Text style={styles.error}>
                    {codeForm.formState.errors.newPassword.message}
                  </Text>
                ) : null}
              </View>

              <Pressable
                style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
                onPress={codeForm.handleSubmit(onConfirm)}
                disabled={confirming}
                accessibilityRole="button"
                accessibilityLabel="Changer mon mot de passe"
              >
                {confirming ? (
                  <ActivityIndicator color={tokens.colors.earth} />
                ) : (
                  <Text style={styles.ctaText}>Changer mon mot de passe</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.secondary}
                onPress={() => setPhone(null)}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryText}>Changer de numéro</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  flex: { flex: 1 },
  header: { paddingHorizontal: tokens.spacing[5], paddingVertical: tokens.spacing[3] },
  scroll: { flexGrow: 1, paddingHorizontal: tokens.spacing[6], paddingTop: tokens.spacing[6] },
  title: { ...tokens.typography.displayMd, color: tokens.colors.field.text },
  text: {
    ...tokens.typography.bodyLg,
    color: tokens.colors.field.textMuted,
    marginTop: tokens.spacing[2],
    marginBottom: tokens.spacing[6],
  },
  field: { marginBottom: tokens.spacing[4] },
  label: {
    ...tokens.typography.label,
    fontSize: 13,
    letterSpacing: 0,
    color: tokens.colors.field.text,
    marginBottom: tokens.spacing[2],
  },
  input: {
    ...tokens.typography.bodyLg,
    color: tokens.colors.field.text,
    minHeight: tokens.touch.primaryButton,
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    borderRadius: tokens.radii.lg,
    paddingHorizontal: tokens.spacing[4],
  },
  inputError: { borderColor: tokens.colors.error },
  error: { ...tokens.typography.bodySm, color: tokens.colors.error, marginTop: tokens.spacing[1] },
  serverError: {
    ...tokens.typography.bodySm,
    color: tokens.colors.error,
    marginBottom: tokens.spacing[4],
  },
  cta: {
    minHeight: tokens.touch.primaryButton,
    backgroundColor: tokens.colors.accent[400],
    borderRadius: tokens.radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing[2],
  },
  ctaPressed: { backgroundColor: tokens.colors.accent[500] },
  ctaText: { ...tokens.typography.button, fontSize: 17, color: tokens.colors.earth },
  secondary: { alignItems: 'center', paddingVertical: tokens.spacing[4] },
  secondaryText: { ...tokens.typography.bodyLg, color: tokens.colors.field.textMuted },
  footnote: {
    ...tokens.typography.bodySm,
    color: tokens.colors.field.textMuted,
    marginTop: tokens.spacing[6],
  },
  doneBox: { alignItems: 'center', paddingTop: tokens.spacing[10] },
  doneDisc: {
    width: 72,
    height: 72,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing[5],
  },
});
