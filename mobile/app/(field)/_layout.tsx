/**
 * Route guard for the field app.
 *
 * - No access token in SecureStore -> redirect to `(auth)/login`.
 * - Token present but the session carries no field-eligible farm role
 *   (OWNER/MANAGER/FARMER/VETERINARIAN — see `@/auth/session`) -> a static
 *   "reserved to field teams" screen. This is what blocks BUYER accounts.
 * - Otherwise -> render the matched child route.
 *
 * Farm selection and every actual field screen are built in task 8+; this
 * layout only gates access to that (currently empty) group.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, Slot } from 'expo-router';
import { getAccessToken } from '@/auth/tokens';
import { decodeSession, hasFieldAccess } from '@/auth/session';
import { tokens } from '@/theme';

type GuardStatus = 'loading' | 'unauthenticated' | 'forbidden' | 'authorized';

export default function FieldLayout() {
  const [status, setStatus] = useState<GuardStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await getAccessToken();
      if (!token) {
        if (!cancelled) setStatus('unauthenticated');
        return;
      }
      try {
        const session = decodeSession(token);
        if (!cancelled) setStatus(hasFieldAccess(session) ? 'authorized' : 'forbidden');
      } catch {
        if (!cancelled) setStatus('unauthenticated');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tokens.colors.primary[600]} />
      </View>
    );
  }

  if (status === 'unauthenticated') {
    return <Redirect href="/(auth)/login" />;
  }

  if (status === 'forbidden') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Accès réservé</Text>
        <Text style={styles.message}>
          Cette application est réservée aux équipes de terrain (propriétaire, gestionnaire,
          éleveur, vétérinaire). Utilisez l&apos;application web pour accéder à votre compte.
        </Text>
      </View>
    );
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.field.background,
    paddingHorizontal: tokens.layout.screenPadding,
  },
  title: {
    ...tokens.typography.headingLg,
    color: tokens.colors.field.text,
    textAlign: 'center',
    marginBottom: tokens.spacing[3],
  },
  message: {
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.textMuted,
    textAlign: 'center',
  },
});
