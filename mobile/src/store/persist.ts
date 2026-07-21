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
 * Two persist configs, nested (redux-persist's documented "Nested Persists"
 * pattern):
 *  - `apiPersistConfig` (this module) wraps `baseApi.reducer` directly —
 *    wired in `@/store/index.ts` as
 *    `persistReducer(apiPersistConfig, baseApi.reducer)`, replacing the
 *    plain `baseApi.reducer` inside `combineReducers`. It blacklists
 *    `mutations` (see below) and persists under its own storage key
 *    (`persist:api`).
 *  - the root config below wraps the whole `rootReducer` and only
 *    whitelists `selection` — the tiny `selectedFarmId` slice. It no
 *    longer whitelists a raw `api`: that would re-persist the *entire*
 *    RTK Query slice (mutations included) on top of the nested config,
 *    defeating it.
 *
 * SECURITY — why `mutations` is blacklisted:
 * RTK Query stores every mutation's resolved payload in
 * `state.api.mutations[requestId].data`. The `login` mutation
 * (`@/store/api/authApi.ts`) resolves to `AuthTokens`
 * (`{ accessToken, refreshToken }`), so without the blacklist, every login
 * would leave a plaintext copy of both tokens sitting in AsyncStorage (NOT
 * secure storage) in addition to the correct `expo-secure-store` copy.
 * `queries` (what the offline cache in `(field)/lots/index.tsx` depends on)
 * plus the harmless `provided`/`subscriptions`/`config` buckets are left
 * untouched — see `apiPersistConfig`'s own comment for the mechanics.
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
 * `persistor.purge()` dispatches a `PURGE` action through the *entire*
 * reducer tree (redux-persist's `combineReducers`-style propagation), so it
 * reaches both the root persistor and the nested `api` persistor in one
 * call — no extra wiring needed at the two call sites above.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistReducer, persistStore, type Persistor, type PersistConfig } from 'redux-persist';
import type { PersistPartial } from 'redux-persist/es/persistReducer';
import type { Action, Reducer, Store } from '@reduxjs/toolkit';
import { baseApi } from './api/baseApi';

type ApiState = ReturnType<typeof baseApi.reducer>;

/**
 * Nested persist config for `state.api` (the RTK Query cache).
 *
 * `blacklist: ['mutations']` operates on the *top-level keys of the api
 * slice's own state* (`queries`, `mutations`, `provided`, `subscriptions`,
 * `config`) — redux-persist's `createPersistoid` filters exactly at that
 * level, before anything is queued for serialization, so a blacklisted
 * `mutations` value is never read, transformed, or written to disk. See
 * `src/store/__tests__/persist.test.ts` for a serialization-level proof
 * (not just a whitelist-string check).
 */
export const apiPersistConfig: PersistConfig<ApiState> = {
  key: 'api',
  storage: AsyncStorage,
  blacklist: ['mutations'],
};

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
    // `api` is deliberately absent: it is persisted by its own nested
    // `persistReducer(apiPersistConfig, baseApi.reducer)` wired in
    // `@/store/index.ts` (see `apiPersistConfig` above for why).
    whitelist: ['selection'],
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
