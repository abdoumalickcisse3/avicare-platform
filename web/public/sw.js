// Minimal service worker — makes the dashboard installable (PWA). No offline
// caching in V1 (the dashboard is an online app); the empty fetch listener
// satisfies the installability requirement while letting the browser handle
// every request normally. Add caching strategies here later if needed.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
