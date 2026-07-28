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
 *
 * Re-evaluation: the mount-only check above only covers the initial load.
 * A background `drain()` pass (triggered by reconnect/app-foreground, see
 * `startSyncTriggers` below) can hit a 401, call `refresh()`, and have
 * `refresh()` give up and purge SecureStore. Without reacting to that, this
 * guard would keep showing `authorized` for a logged-out session.
 * `subscribeAuthInvalidated` (from `sync/index.ts`) is the signal: on fire,
 * flip status to `unauthenticated` so the existing `<Redirect>` branch below
 * fires immediately, no re-navigation needed.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { getAccessToken } from '@/auth/tokens';
import { decodeSession, hasFieldAccess } from '@/auth/session';
import { useFarmAccess } from '@/auth/useSession';
import { tokens } from '@/theme';
import { BottomNavBar } from '@/components/ui/BottomNavBar';
import { DrawerOverlay } from '@/components/navigation/DrawerOverlay';
import { NavProvider } from '@/navigation/NavContext';
import { startSyncTriggers } from '@/sync/triggers';
import { subscribeAuthInvalidated } from '@/sync';

type GuardStatus = 'loading' | 'unauthenticated' | 'forbidden' | 'authorized';

export default function FieldLayout() {
  const [status, setStatus] = useState<GuardStatus>('loading');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isAdmin, can } = useFarmAccess();

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

  // A background `drain()` can discover the session is dead (failed
  // refresh) well after the mount-only check above ran. Re-drive the guard
  // to `unauthenticated` when that happens so the `<Redirect>` branch below
  // fires right away, instead of leaving `authorized` stale for a
  // logged-out user until the next manual navigation.
  useEffect(() => {
    return subscribeAuthInvalidated(() => {
      setStatus('unauthenticated');
    });
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
    <NavProvider value={{ isAdmin, can, openDrawer: () => setDrawerOpen(true) }}>
      <View style={styles.authorized}>
        <Stack screenOptions={{ headerShown: false }} />
        <BottomNavBar />
      </View>
      <DrawerOverlay visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </NavProvider>
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
