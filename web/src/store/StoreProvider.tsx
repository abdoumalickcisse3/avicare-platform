"use client";

import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "./store";
import { hydrateFromStorage } from "./slices/authSlice";

/** Per-request Redux store provider; rehydrates tokens from storage on mount. */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState<AppStore>(() => makeStore());

  useEffect(() => {
    store.dispatch(hydrateFromStorage());
  }, [store]);

  return <Provider store={store}>{children}</Provider>;
}
