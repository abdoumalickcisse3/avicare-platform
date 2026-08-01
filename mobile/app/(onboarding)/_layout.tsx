/**
 * Auth guard for the onboarding group. No access token in SecureStore →
 * redirect to `(auth)/login`. Otherwise render the wizard. Unlike the field
 * layout, there is no farm-role gate here — onboarding is for a freshly created
 * OWNER whose token already carries the membership (refreshed at signup).
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { getAccessToken } from '@/auth/tokens';
import { tokens } from '@/theme';

type Status = 'loading' | 'unauthenticated' | 'authorized';

export default function OnboardingLayout() {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      if (!cancelled) setStatus(token ? 'authorized' : 'unauthenticated');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.colors.primary[600]} />
      </View>
    );
  }
  if (status === 'unauthenticated') return <Redirect href="/(auth)/login" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.neutral[900] },
});
