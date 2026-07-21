/**
 * Root Redux store.
 *
 * Two reducers live here:
 *  - `api`       — the RTK Query cache (`baseApi`, extended by `farmsApi` /
 *    `productionUnitsApi` / `authApi` via `injectEndpoints`), wrapped in its
 *    own nested `persistReducer(apiPersistConfig, baseApi.reducer)` so its
 *    `mutations` bucket (which would otherwise hold plaintext auth tokens
 *    from the `login`/`refresh` mutations) never reaches disk — see
 *    `@/store/persist`'s header for the full rationale.
 *  - `selection` — the tiny `selectedFarmId` slice (task 8).
 *
 * No auth slice: the session is derived on demand from the SecureStore-backed
 * access token (`@/auth/session`), never mirrored into Redux state.
 *
 * `redux-persist` (see `@/store/persist`) wraps this root reducer with a
 * restricted whitelist (`selection` only — `api` is persisted by its own
 * nested config above, not by the root whitelist). `persistor` is exported
 * for `PersistGate` (root layout) and for the logout/farm-change purge call
 * sites.
 */
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { FLUSH, PAUSE, PERSIST, persistReducer, PURGE, REGISTER, REHYDRATE } from 'redux-persist';
import { baseApi } from './api/baseApi';
import { selectionReducer } from './slices/selectionSlice';
import { apiPersistConfig, createPersistor, wrapWithPersistence } from './persist';

const rootReducer = combineReducers({
  [baseApi.reducerPath]: persistReducer(apiPersistConfig, baseApi.reducer),
  selection: selectionReducer,
});

const persistedReducer = wrapWithPersistence(rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // redux-persist dispatches non-serializable actions during
      // rehydration/persistence bookkeeping; these are the documented ones
      // to exempt (see redux-persist's own "Integration: getDefaultMiddleware").
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(baseApi.middleware),
});

export const persistor = createPersistor(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
