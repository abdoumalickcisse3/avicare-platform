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
import { SyncStatusBar } from '@/components/SyncStatusBar';
import { useSyncStatus } from '@/sync/useSyncStatus';
import { startSyncTriggers } from '@/sync/triggers';

type GuardStatus = 'loading' | 'unauthenticated' | 'forbidden' | 'authorized';

export default function FieldLayout() {
  const [status, setStatus] = useState<GuardStatus>('loading');
  const syncStatus = useSyncStatus();

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

  // Background sync triggers (reconnect, app foreground) run for the whole
  // field app, independent of the guard status above — starting them here
  // keeps a single subscription per mount instead of per-screen.
  useEffect(() => {
    const stopSyncTriggers = startSyncTriggers();
    return stopSyncTriggers;
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

  return (
    <View style={styles.authorized}>
      <SyncStatusBar {...syncStatus} />
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  authorized: {
    flex: 1,
  },
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
