"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production so the dashboard is installable as
 * a PWA. No-op in development and where service workers aren't supported.
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // registration failures are non-fatal — the app still works, just not installable
    });
  }, []);
  return null;
}
