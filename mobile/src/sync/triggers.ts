/**
 * Background sync triggers: drain the shared queue (`./index.ts`) whenever
 * the device regains connectivity or the app returns to the foreground.
 *
 * Both listeners call the SAME singleton `syncEngine.drain()` — never a
 * locally-created engine — so there is exactly one queue/engine pair for the
 * whole app (see `index.ts`'s header comment).
 *
 * No unit test: like `useSyncStatus`, this only wires NetInfo/AppState
 * (no meaningful behaviour under Jest) to the already-tested engine.
 * Verified by `tsc --noEmit` and by running the app.
 */
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { syncEngine } from './index';

function triggerDrain(): void {
  // drain() itself never rejects (the engine classifies every transport
  // failure internally), but a trigger callback must never produce an
  // unhandled promise rejection regardless.
  syncEngine.drain().catch(() => undefined);
}

/**
 * Subscribes both triggers and returns a single unsubscribe function.
 * Call once (e.g. in `(field)/_layout.tsx`'s `useEffect`) and call the
 * returned function on cleanup.
 */
export function startSyncTriggers(): () => void {
  let wasConnected = true;

  const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    const isConnected = Boolean(state.isConnected);
    if (!wasConnected && isConnected) {
      triggerDrain();
    }
    wasConnected = isConnected;
  });

  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      triggerDrain();
    }
  };
  const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  return () => {
    unsubscribeNetInfo();
    appStateSubscription.remove();
  };
}
