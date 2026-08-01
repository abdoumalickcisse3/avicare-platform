/**
 * Signup — identity only. The farm is provisioned with a default name so the
 * onboarding wizard has one to configure (the owner names it in step 2). After
 * the account + farm are created, the session is refreshed so the token carries
 * the new OWNER membership, then the wizard opens. Retry-safe: re-taps don't
 * re-sign-up or re-create the farm.
 */
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { tokens } from '@/theme';
import { FormField } from '@/components/field/FormField';
import { getRefreshToken, saveTokens } from '@/auth/tokens';
import { useSignupMutation, useRefreshMutation } from '@/store/api/authApi';
import { useCreateFarmMutation } from '@/store/api/farmsApi';

const schema = z
  .object({
    firstName: z.string().min(1, 'Prénom requis'),
    lastName: z.string().min(1, 'Nom requis'),
    email: z.string().min(1, "Adresse e-mail requise").email('Adresse e-mail invalide'),
    phone: z.string().max(30, '30 caractères maximum').optional().or(z.literal('')),
    password: z.string().min(8, '8 caractères minimum'),
    confirmPassword: z.string().min(1, 'Veuillez confirmer le mot de passe'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });
type SignupValues = z.infer<typeof schema>;

export default function SignupScreen() {
  const router = useRouter();
  const [signup] = useSignupMutation();
  const [createFarm] = useCreateFarmMutation();
  const [refresh] = useRefreshMutation();

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const orch = useRef<{ signedUp: boolean; farmId: number | null }>({ signedUp: false, farmId: null });

  const { control, handleSubmit } = useForm<SignupValues>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (v: SignupValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      if (!orch.current.signedUp) {
        const tokensResp = await signup({
          fullName: `${v.firstName} ${v.lastName}`.trim(),
          email: v.email,
          password: v.password,
          phone: v.phone ? v.phone : undefined,
        }).unwrap();
        await saveTokens(tokensResp);
        orch.current.signedUp = true;
      }
      if (!orch.current.farmId) {
        const defaultName = v.firstName.trim() ? `Ferme de ${v.firstName.trim()}` : 'Ma ferme';
        const farm = await createFarm({ name: defaultName }).unwrap();
        orch.current.farmId = farm.id;
        const rt = await getRefreshToken();
        if (rt) {
          const refreshed = await refresh({ refreshToken: rt }).unwrap();
          await saveTokens(refreshed);
        }
      }
      router.replace('/(onboarding)');
    } catch (err) {
      const status = (err as { status?: number | string })?.status;
      if (status === 409 || status === 400) {
        setServerError('Cet e-mail est peut-être déjà utilisé. Vérifiez vos informations.');
      } else {
        setServerError('Serveur injoignable. Vérifiez votre connexion et réessayez.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Créer votre compte</Text>
          <Text style={styles.subtitle}>Rejoignez l&apos;aviculture moderne au Sénégal.</Text>

          {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

          <View style={styles.form}>
            <Controller
              control={control}
              name="firstName"
              render={({ field: { onChange, value }, fieldState }) => (
                <FormField label="Prénom" placeholder="Ex. Awa" value={value} onChangeText={onChange} error={fieldState.error?.message} />
              )}
            />
            <Controller
              control={control}
              name="lastName"
              render={({ field: { onChange, value }, fieldState }) => (
                <FormField label="Nom" placeholder="Ex. Diop" value={value} onChangeText={onChange} error={fieldState.error?.message} />
              )}
            />
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value }, fieldState }) => (
                <FormField
                  label="Adresse e-mail"
                  placeholder="vous@exemple.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={value}
                  onChangeText={onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, value }, fieldState }) => (
                <FormField label="Téléphone (optionnel)" placeholder="77 000 00 00" keyboardType="phone-pad" value={value} onChangeText={onChange} error={fieldState.error?.message} />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value }, fieldState }) => (
                <FormField label="Mot de passe" placeholder="••••••••" secureTextEntry value={value} onChangeText={onChange} error={fieldState.error?.message} helperText="8 caractères minimum" />
              )}
            />
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, value }, fieldState }) => (
                <FormField label="Confirmation" placeholder="••••••••" secureTextEntry value={value} onChangeText={onChange} error={fieldState.error?.message} />
              )}
            />

            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Créer mon compte"
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, submitting && styles.ctaDisabled]}
            >
              <Text style={styles.ctaText}>{submitting ? 'Création…' : 'Créer mon compte'}</Text>
            </Pressable>

            <Pressable onPress={() => router.push('/(auth)/login')} accessibilityRole="button" style={styles.loginLink}>
              <Text style={styles.loginText}>Déjà inscrit ? Se connecter</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: tokens.spacing[6], paddingVertical: tokens.spacing[6] },
  title: { ...tokens.typography.displayLg, color: tokens.colors.neutral[900] },
  subtitle: { ...tokens.typography.bodyMd, color: tokens.colors.neutral[600], marginTop: tokens.spacing[1], marginBottom: tokens.spacing[5] },
  serverError: { ...tokens.typography.bodySm, color: tokens.colors.error, marginBottom: tokens.spacing[3] },
  form: { gap: tokens.spacing[4] },
  cta: {
    minHeight: tokens.touch.primaryButton,
    backgroundColor: tokens.colors.accent[400],
    borderRadius: tokens.radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing[2],
  },
  ctaPressed: { backgroundColor: tokens.colors.accent[500] },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { ...tokens.typography.button, fontSize: 17, color: tokens.colors.earth },
  loginLink: { alignItems: 'center', marginTop: tokens.spacing[2] },
  loginText: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.primary[600] },
});
