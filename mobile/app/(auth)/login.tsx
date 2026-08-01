/**
 * Login — redesigned to the Stitch "Connexion - AviCare Mobile" reference:
 * language toggle, centered logo + tagline, labelled fields (email + password
 * with a show/hide eye), a big orange CTA, a forgot-password link and a footer.
 *
 * The backend authenticates on { email, password } (same contract as the web),
 * so the identifier stays an email even though the mock shows a phone — phone
 * login needs backend support (V2). Brand tokens + lucide icons throughout.
 */
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react-native';
import { tokens } from '@/theme';
import { saveTokens } from '@/auth/tokens';
import { useLoginMutation } from '@/store/api/authApi';

const loginSchema = z.object({
  email: z.string().min(1, "L'adresse e-mail est requise").email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});
type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const [login, { isLoading }] = useLoginMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [lang, setLang] = useState<'FR' | 'WO'>('FR');

  const { control, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    try {
      const authTokens = await login(values).unwrap();
      await saveTokens(authTokens);
      router.replace('/(field)');
    } catch (err) {
      // Distinguish a rejected login (server reachable, wrong credentials)
      // from a connectivity failure (server unreachable) — otherwise a network
      // problem looks like a bad password and sends the user chasing the wrong
      // thing. RTK Query surfaces network failures as a non-numeric status.
      const status = (err as { status?: number | string })?.status;
      if (status === 401 || status === 400) {
        setSubmitError('Identifiants invalides. Vérifiez votre e-mail et votre mot de passe.');
      } else {
        setSubmitError('Serveur injoignable. Vérifiez votre connexion et réessayez.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Language toggle */}
          <View style={styles.langRow}>
            <View style={styles.langPill}>
              <Pressable onPress={() => setLang('FR')} style={[styles.langBtn, lang === 'FR' && styles.langActive]} accessibilityRole="button" accessibilityLabel="Français">
                <Text style={[styles.langText, lang === 'FR' && styles.langTextActive]}>FR</Text>
              </Pressable>
              <Pressable onPress={() => setLang('WO')} style={[styles.langBtn, lang === 'WO' && styles.langActive]} accessibilityRole="button" accessibilityLabel="Wolof">
                <Text style={[styles.langText, lang === 'WO' && styles.langTextActive]}>Wolof</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.middle}>
          {/* Brand */}
          <View style={styles.brand}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          </View>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Adresse e-mail</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="vous@exemple.com"
                  placeholderTextColor={tokens.colors.field.disabled}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {errors.email ? <Text style={styles.error}>{errors.email.message}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={[styles.inputWrap, errors.password && styles.inputError]}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextInput
                    style={styles.inputFlex}
                    placeholder="••••••••"
                    placeholderTextColor={tokens.colors.field.disabled}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
              <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8} accessibilityRole="button" accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                {showPassword ? <EyeOff size={20} color={tokens.colors.field.textMuted} /> : <Eye size={20} color={tokens.colors.field.textMuted} />}
              </Pressable>
            </View>
            {errors.password ? <Text style={styles.error}>{errors.password.message}</Text> : null}
          </View>

          {submitError ? <Text style={[styles.error, styles.submitError]}>{submitError}</Text> : null}

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, isLoading && styles.ctaDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Se connecter"
          >
            <Text style={styles.ctaText}>{isLoading ? 'Connexion…' : 'Se connecter'}</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgot} accessibilityRole="button">
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/(auth)/signup')} style={styles.signup} accessibilityRole="button" accessibilityLabel="Créer un compte">
            <Text style={styles.signupText}>Pas de compte ? Créer un compte</Text>
          </Pressable>
          </View>

          <Text style={styles.footer}>SÉCURISÉ PAR JAWDI · DAKAR</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.neutral[50] },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: tokens.spacing[6], paddingBottom: tokens.spacing[6] },
  langRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: tokens.spacing[2] },
  langPill: { flexDirection: 'row', backgroundColor: tokens.colors.neutral[100], borderRadius: tokens.radii.full, padding: 3 },
  langBtn: { paddingHorizontal: tokens.spacing[3], paddingVertical: tokens.spacing[1], borderRadius: tokens.radii.full },
  langActive: { backgroundColor: tokens.colors.primary[600] },
  langText: { ...tokens.typography.bodySm, fontWeight: '700', color: tokens.colors.field.textMuted },
  langTextActive: { color: tokens.colors.neutral[0] },
  middle: { flex: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: tokens.spacing[8] },
  logo: { height: 56, width: 200 },
  tagline: { ...tokens.typography.bodyLg, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2] },
  field: { marginBottom: tokens.spacing[4] },
  label: { ...tokens.typography.label, fontSize: 13, letterSpacing: 0, color: tokens.colors.field.text, marginBottom: tokens.spacing[2] },
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: tokens.touch.primaryButton,
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    borderRadius: tokens.radii.lg,
    paddingHorizontal: tokens.spacing[4],
  },
  inputFlex: { flex: 1, ...tokens.typography.bodyLg, color: tokens.colors.field.text },
  inputError: { borderColor: tokens.colors.error },
  error: { ...tokens.typography.bodySm, color: tokens.colors.error, marginTop: tokens.spacing[1] },
  submitError: { textAlign: 'center', marginBottom: tokens.spacing[2] },
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
  forgot: { alignItems: 'center', marginTop: tokens.spacing[4] },
  forgotText: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.primary[600] },
  signup: { alignItems: 'center', marginTop: tokens.spacing[3] },
  signupText: { ...tokens.typography.bodyMd, fontWeight: '600', color: tokens.colors.field.textMuted },
  footer: { ...tokens.typography.bodySm, fontSize: 11, letterSpacing: 0.5, color: tokens.colors.field.disabled, textAlign: 'center', marginTop: tokens.spacing[6] },
});
