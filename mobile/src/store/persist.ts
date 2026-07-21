/**
 * Restricted `redux-persist` configuration.
 *
 * The persisted cache is strictly disposable: everything it stores can be
 * re-fetched from the backend. It exists only so the farm selector and the
 * batch list stay visible while the device is offline (task 8's core
 * requirement) — it is not a source of truth, and it is NOT where tokens
 * live (those stay in `expo-secure-store`, see `@/auth/tokens` — never
 * persisted here).
 *
 * Whitelist:
 *  - `api`       — the RTK Query cache (farms, production units, ...).
 *  - `selection` — the tiny `selectedFarmId` slice.
 *
 * Purging: the cache must not survive a logout or a farm switch (stale
 * batches from farm A must never render under farm B). This module only
 * exposes `wrapWithPersistence` + a `purgePersistedCache` helper around the
 * persistor; the actual trigger points are:
 *  - `app/_layout.tsx` — subscribes to `subscribeAuthInvalidated` (fires on
 *    both an explicit logout and a forced session drop after a failed
 *    refresh) and purges there.
 *  - `app/(field)/index.tsx` — purges when the farmer picks a (different)
 *    farm, before navigating to the batch list.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistReducer, persistStore, type Persistor, type PersistConfig } from 'redux-persist';
import type { PersistPartial } from 'redux-persist/es/persistReducer';
import type { Action, Reducer, Store } from '@reduxjs/toolkit';

/**
 * Wraps a root reducer with the restricted persistence config above. Kept
 * generic (rather than a standalone exported `PersistConfig` object) so the
 * state type `S` is inferred from the actual root reducer passed in by
 * `@/store`, instead of being fixed to some unrelated shape here.
 */
export function wrapWithPersistence<S, A extends Action = Action>(
  rootReducer: Reducer<S, A>,
): Reducer<S & PersistPartial, A> {
  const config: PersistConfig<S> = {
    key: 'avicare-root',
    storage: AsyncStorage,
    whitelist: ['api', 'selection'],
  };
  return persistReducer(config, rootReducer);
}

export function createPersistor(store: Store): Persistor {
  return persistStore(store);
}

/** Wipes the on-disk cache and the in-memory redux-persist bookkeeping. */
export async function purgePersistedCache(persistor: Persistor): Promise<void> {
  await persistor.purge();
}
