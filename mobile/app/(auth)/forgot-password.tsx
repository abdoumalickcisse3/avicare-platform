/**
 * Mot de passe oublié — styled to match the login (Stitch reference). Collects
 * an e-mail and shows a neutral confirmation. NOTE: not yet wired to a backend
 * reset endpoint (V2) — the confirmation is deliberately non-committal and does
 * not leak whether an account exists.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, MailCheck } from 'lucide-react-native';
import { tokens } from '@/theme';

const schema = z.object({ email: z.string().min(1, "L'adresse e-mail est requise").email('Adresse e-mail invalide') });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = () => setSent(true);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retour">
            <ArrowLeft size={24} color={tokens.colors.field.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {sent ? (
            <View style={styles.doneBox}>
              <View style={styles.doneDisc}>
                <MailCheck size={32} color={tokens.colors.primary[600]} />
              </View>
              <Text style={styles.title}>Vérifiez vos e-mails</Text>
              <Text style={styles.text}>
                Si un compte est associé à cette adresse, vous recevrez un lien pour réinitialiser votre mot de passe.
              </Text>
              <Pressable style={styles.cta} onPress={() => router.replace('/(auth)/login')} accessibilityRole="button">
                <Text style={styles.ctaText}>Retour à la connexion</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Mot de passe oublié</Text>
              <Text style={styles.text}>Saisissez votre adresse e-mail. Nous vous enverrons un lien de réinitialisation.</Text>

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

              <Pressable style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]} onPress={handleSubmit(onSubmit)} accessibilityRole="button" accessibilityLabel="Réinitialiser">
                <Text style={styles.ctaText}>Envoyer le lien</Text>
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
  text: { ...tokens.typography.bodyLg, color: tokens.colors.field.textMuted, marginTop: tokens.spacing[2], marginBottom: tokens.spacing[6] },
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
  inputError: { borderColor: tokens.colors.error },
  error: { ...tokens.typography.bodySm, color: tokens.colors.error, marginTop: tokens.spacing[1] },
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
  doneBox: { alignItems: 'center', paddingTop: tokens.spacing[10] },
  doneDisc: { width: 72, height: 72, borderRadius: tokens.radii.full, backgroundColor: tokens.colors.primary[50], alignItems: 'center', justifyContent: 'center', marginBottom: tokens.spacing[5] },
});
