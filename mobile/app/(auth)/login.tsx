import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { tokens } from '@/theme';
import { saveTokens } from '@/auth/tokens';
import { useLoginMutation } from '@/store/api/authApi';

const loginSchema = z.object({
  email: z.string().min(1, "L'email est requis").email('Email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const [login, { isLoading }] = useLoginMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    try {
      const authTokens = await login(values).unwrap();
      await saveTokens(authTokens);
      router.replace('/(field)');
    } catch {
      setSubmitError('Identifiants invalides. Vérifiez votre email et votre mot de passe.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>AviCare</Text>
        <Text style={styles.subtitle}>Connexion</Text>

        <View style={styles.field}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onBlur, onChange, value } }) => (
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={tokens.colors.field.textMuted}
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

        <View style={styles.field}>
          <Controller
            control={control}
            name="password"
            render={({ field: { onBlur, onChange, value } }) => (
              <TextInput
                style={styles.input}
                placeholder="Mot de passe"
                placeholderTextColor={tokens.colors.field.textMuted}
                secureTextEntry
                autoComplete="password"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.password ? <Text style={styles.error}>{errors.password.message}</Text> : null}
        </View>

        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={isLoading}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{isLoading ? 'Connexion…' : 'Se connecter'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.field.background,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: tokens.layout.screenPadding,
  },
  title: {
    ...tokens.typography.displayLg,
    color: tokens.colors.field.text,
    textAlign: 'center',
  },
  subtitle: {
    ...tokens.typography.headingMd,
    color: tokens.colors.field.textMuted,
    textAlign: 'center',
    marginBottom: tokens.spacing[6],
  },
  field: {
    marginBottom: tokens.spacing[4],
  },
  input: {
    ...tokens.typography.bodyLg,
    color: tokens.colors.field.text,
    height: tokens.touch.field,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.field.rule,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing[4],
  },
  error: {
    ...tokens.typography.bodySm,
    color: tokens.colors.error,
    marginTop: tokens.spacing[1],
  },
  button: {
    height: tokens.touch.button,
    backgroundColor: tokens.colors.action.commit.bg,
    borderWidth: tokens.layout.borderWidth,
    borderColor: tokens.colors.action.commit.border,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing[4],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...tokens.typography.button,
    color: tokens.colors.action.commit.fg,
  },
});
