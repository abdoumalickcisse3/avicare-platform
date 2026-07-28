/**
 * Splash / entry route (`/`) — Stitch "Splash Screen - AviCare Mobile"
 * reference: a full-bleed farm photo under a green brand wash, the centered
 * Jawdi logo, and a bottom status line. Decides where to go (field app if a
 * token is stored, otherwise login) and doubles as the app's initial route.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { getAccessToken } from '@/auth/tokens';
import { tokens } from '@/theme';

export default function Splash() {
  const [target, setTarget] = useState<'/(field)' | '/(auth)/login' | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      // Keep the splash on screen long enough to read as a brand moment.
      await new Promise((r) => setTimeout(r, 2200));
      if (!cancelled) setTarget(token ? '/(field)' : '/(auth)/login');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (target) return <Redirect href={target} />;

  return (
    <ImageBackground source={require('../assets/equipements-ferme.jpg')} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay} />

      <View style={styles.center}>
        <Image source={require('../assets/logo-dark.png')} style={styles.logo} resizeMode="contain" />
      </View>

      <View style={styles.bottom}>
        <ActivityIndicator color="#FFFFFF" />
        <Text style={styles.status}>SYNCHRONISATION</Text>
        <Text style={styles.version}>v1.0.0</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  // Green brand wash over the photo (primary[900] = #122B12 → rgb(18,43,18)).
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(18,43,18,0.55)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { height: 76, width: 250 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: tokens.spacing[12], alignItems: 'center', gap: tokens.spacing[3] },
  status: { ...tokens.typography.label, fontSize: 11, letterSpacing: 2, color: 'rgba(255,255,255,0.85)' },
  version: { ...tokens.typography.bodySm, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
});
