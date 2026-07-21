/**
 * Live sync status for the always-visible `SyncStatusBar` (design direction
 * §6). Reads the shared queue singleton (`./index.ts`) and the device's
 * connectivity, and re-renders whenever either changes.
 *
 * `countPending()`/`listFailed()` are synchronous SQLite reads, not
 * reactive — this hook re-reads them every time the singleton calls
 * `notify()` (on `enqueue` and on each edge of `drain()`), via `subscribe`.
 *
 * No unit test here (NetInfo has no meaningful behaviour under Jest); the
 * pure text/priority logic it feeds lives in `SyncStatusBar` and is
 * covered there. Verified by `tsc --noEmit` and by running the app.
 */
import { useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { isSyncing, queue, subscribe } from './index';

export type SyncStatus = {
  online: boolean;
  pending: number;
  failed: number;
  syncing: boolean;
};

function readStatus(online: boolean): SyncStatus {
  return {
    online,
    pending: queue.countPending(),
    failed: queue.listFailed().length,
    syncing: isSyncing(),
  };
}

export function useSyncStatus(): SyncStatus {
  const onlineRef = useRef(true);
  const [status, setStatus] = useState<SyncStatus>(() => readStatus(onlineRef.current));

  useEffect(() => {
    const applyOnline = (online: boolean) => {
      onlineRef.current = online;
      setStatus(readStatus(online));
    };

    NetInfo.fetch()
      .then((state) => applyOnline(Boolean(state.isConnected)))
      .catch(() => undefined);

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      applyOnline(Boolean(state.isConnected));
    });
    const unsubscribeQueue = subscribe(() => {
      setStatus(readStatus(onlineRef.current));
    });

    return () => {
      unsubscribeNetInfo();
      unsubscribeQueue();
    };
  }, []);

  return status;
}
