/**
 * The one way out of a session.
 *
 * <p>Clearing the tokens is not enough: the RTK Query cache and the selected farm are persisted to
 * AsyncStorage, and on a phone that gets handed around a barn the next person would open the app
 * on the previous account's data. `notifyAuthInvalidated` is what `app/_layout.tsx` listens to in
 * order to purge both — the same signal a refresh raises when it gives up, so a deliberate logout
 * and a forced one end in exactly the same state.
 */
import { clearTokens } from './tokens';
import { notifyAuthInvalidated } from '@/sync';

export async function signOut(): Promise<void> {
  await clearTokens();
  notifyAuthInvalidated();
}
