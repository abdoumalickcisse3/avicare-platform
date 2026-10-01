/**
 * Background sync triggers: drain the shared queue (`./index.ts`) at launch, whenever the device
 * regains connectivity, when the app returns to the foreground, and — while entries are still
 * waiting — on a backoff timer.
 *
 * All of them call the SAME singleton `syncEngine.drain()` — never a locally-created engine — so
 * there is exactly one queue/engine pair for the whole app (see `index.ts`'s header comment).
 *
 * The timer is what makes a failed pass recover on its own. Without it a send that failed on a
 * weak signal waited for the next offline→online edge or a foreground, and a farmer who stayed in
 * the app on a flaky connection saw "N en attente" for as long as they stood there.
 */
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { syncEngine } from './index';
import { backoffMs } from './engine';
import { isOnline } from './isOnline';

/**
 * Subscribes every trigger and returns a single unsubscribe function.
 * Call once (e.g. in `(field)/_layout.tsx`'s `useEffect`) and call the
 * returned function on cleanup.
 */
export function startSyncTriggers(): () => void {
  let wasOnline = true;
  let stopped = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let failedPasses = 0;

  function clearRetry(): void {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }

  function triggerDrain(): void {
    clearRetry();
    // drain() itself never rejects (the engine classifies every transport failure internally), but
    // a trigger callback must never produce an unhandled promise rejection regardless.
    syncEngine
      .drain()
      .then((result) => {
        if (stopped) return;
        if (result.retryable === 0) {
          failedPasses = 0;
          return;
        }
        failedPasses += 1;
        retryTimer = setTimeout(triggerDrain, backoffMs(failedPasses));
      })
      .catch(() => undefined);
  }

  // Entries left over from the last session (app killed with work queued) are sent at launch
  // instead of waiting for the next connectivity change.
  triggerDrain();

  const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    const online = isOnline(state);
    if (!wasOnline && online) {
      failedPasses = 0;
      triggerDrain();
    }
    wasOnline = online;
  });

  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      failedPasses = 0;
      triggerDrain();
    }
  };
  const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  return () => {
    stopped = true;
    clearRetry();
    unsubscribeNetInfo();
    appStateSubscription.remove();
  };
}
