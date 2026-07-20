/**
 * Root Redux store. Only the RTK Query `api` slice lives here for now — no
 * auth slice: the session is derived on demand from the SecureStore-backed
 * access token (`@/auth/session`), never mirrored into Redux state.
 *
 * `redux-persist` is a dependency for a later task (offline mutation queue,
 * task 5+); the auth slice deliberately opts out of persistence.
 */
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from './api/baseApi';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
