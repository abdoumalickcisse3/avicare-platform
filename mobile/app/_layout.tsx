import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from '@expo-google-fonts/outfit';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { persistor, store } from '@/store';
import { baseApi } from '@/store/api/baseApi';
import { setSelectedFarmId } from '@/store/slices/selectionSlice';
import { purgePersistedCache } from '@/store/persist';
import { subscribeAuthInvalidated } from '@/sync';
import { tokens } from '@/theme';

/**
 * Logout purge: `subscribeAuthInvalidated` fires whenever the session dies —
 * an explicit logout and a forced drop (failed background refresh, see
 * `(field)/_layout.tsx`) both go through it, since neither this app nor the
 * store has a separate "logout" action today. The persisted cache (farms,
 * production units, selected farm) must not leak into the next session.
 */
function AuthInvalidationPurge() {
  useEffect(() => {
    return subscribeAuthInvalidated(() => {
      store.dispatch(setSelectedFarmId(null));
      store.dispatch(baseApi.util.resetApiState());
      void purgePersistedCache(persistor);
    });
  }, []);

  return null;
}

export default function RootLayout() {
  // Load the same typefaces as the web (Outfit + JetBrains Mono, per weight)
  // so the app renders in the brand type, not the device system font. The
  // weighted family names must match `tokens.fontFamily.*`.
  const [fontsLoaded] = useFonts({
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    JetBrainsMono_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={tokens.colors.primary[600]} />
      </View>
    );
  }

  return (
    <Provider store={store}>
      <PersistGate
        loading={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={tokens.colors.primary[600]} />
          </View>
        }
        persistor={persistor}
      >
        <AuthInvalidationPurge />
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
}
