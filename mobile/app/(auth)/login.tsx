/**
 * Login — redesigned to the Stitch "Connexion - AviCare Mobile" reference:
 * language toggle, centered logo + tagline, labelled fields (email + password
 * with a show/hide eye), a big orange CTA, a forgot-password link and a footer.
 *
 * The backend authenticates on { email, password } (same contract as the web), but that
 * field carries an IDENTIFIER since 2026-10-08: an address or a phone number. The wire name
 * stays `email` because builds already on testers' phones send it. The mock always showed a
 * phone; it took the server catching up for the screen to be allowed to agree — phone
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
import { PhoneInput } from '@/phone/PhoneInput';

const loginSchema = z.object({
  // An address or a phone number: the backend resolves either since 2026-10-08. No shape
  // check here — refusing a number the server would have accepted is the worse error.
  email: z.string().min(1, 'Identifiant requis'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});
type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * Which kind of identifier the person is typing.
 *
 * The server accepts either, but the SCREEN has to know: a phone field needs a country picker and
 * an address does not. Without the choice the field can only guess a country, and guessing is the
 * bug this whole thread started from — a Beninese worker typing 01 56 34 34 08 would be looked up
 * as +221 156343408 and found nowhere.
 */
type IdentifierMode = 'email' | 'phone';

export default function LoginScreen() {
  const router = useRouter();
  const [login, { isLoading }] = useLoginMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [lang, setLang] = useState<'FR' | 'WO'>('FR');
  const [mode, setMode] = useState<IdentifierMode>('email');

  const { control, handleSubmit, setValue, formState: { errors } } = useForm<LoginFormValues>({
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

          {/* Deux onglets plutôt qu'une liste : un geste au lieu de deux, avec des gants. */}
          <View style={styles.modeRow} accessibilityRole="tablist">
            {(['email', 'phone'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  setMode(m);
                  // The two shapes have nothing in common: carrying one over as the other would
                  // leave a half-address in a phone field.
                  setValue('email', '');
                }}
                style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === m }}
                accessibilityLabel={m === 'email' ? 'Identifiant par e-mail' : 'Identifiant par numéro'}
              >
                <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                  {m === 'email' ? 'E-mail' : 'Numéro'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.field}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onBlur, onChange, value } }) =>
                mode === 'phone' ? (
                  <PhoneInput value={value} onChange={onChange} label="Numéro de téléphone" />
                ) : (
                  <>
                    <Text style={styles.label}>Adresse e-mail</Text>
                    <TextInput
                      style={[styles.input, errors.email && styles.inputError]}
                      placeholder="vous@exemple.com"
                      placeholderTextColor={tokens.colors.field.disabled}
                      autoCapitalize="none"
                      autoComplete="email"
                      accessibilityLabel="Adresse e-mail"
                      keyboardType="email-address"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                  </>
                )
              }
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
                    accessibilityLabel="Mot de passe"
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
  modeRow: {
    flexDirection: 'row',
    gap: tokens.spacing[2],
    marginBottom: tokens.spacing[3],
  },
  modeBtn: {
    flex: 1,
    minHeight: tokens.touch.field,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radii.lg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    backgroundColor: tokens.colors.neutral[0],
  },
  modeBtnActive: {
    backgroundColor: tokens.colors.primary[600],
    borderColor: tokens.colors.primary[600],
  },
  modeText: { ...tokens.typography.button, color: tokens.colors.field.text },
  modeTextActive: { color: tokens.colors.neutral[0] },
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
  footer: { ...tokens.typography.bodySm, fontSize: 11, letterSpacing: 0.5, color: tokens.colors.field.disabled, textAlign: 'center', marginTop: tokens.spacing[6] },
});
