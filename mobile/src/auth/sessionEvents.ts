/**
 * "The access token changed" — a signal, not a store.
 *
 * <p>`useFarmAccess` decodes the token once on mount, so a token replaced mid-session (a refresh
 * after a farm is created, say) leaves the decoded memberships stale: the app holds a token that
 * says OWNER while the screen still believes it has no membership, and hides the sections that
 * ownership unlocks. Subscribers re-read the token when this fires.
 *
 * <p>Kept apart from `notifyAuthInvalidated` in `@/sync` on purpose: that one means "the session is
 * gone, purge everything", this one means "same user, richer token".
 */
const listeners = new Set<() => void>();

export function subscribeSessionChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifySessionChanged(): void {
  for (const listener of listeners) listener();
}
