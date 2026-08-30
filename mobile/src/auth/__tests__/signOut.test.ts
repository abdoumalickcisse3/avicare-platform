/**
 * Signing out must leave nothing behind.
 *
 * The two logout buttons used to call `clearTokens` directly, which cleared the tokens and left
 * the persisted RTK Query cache and the selected farm on disk. On a phone that gets handed around
 * a barn, the next person opened the app on the previous account's data.
 */
import { signOut } from '../signOut';
import { clearTokens } from '../tokens';
import { notifyAuthInvalidated } from '@/sync';

jest.mock('../tokens', () => ({ clearTokens: jest.fn(async () => {}) }));
jest.mock('@/sync', () => ({ notifyAuthInvalidated: jest.fn() }));

describe('signOut', () => {
  beforeEach(() => jest.clearAllMocks());

  it('clears the tokens and raises the invalidation signal', async () => {
    await signOut();

    expect(clearTokens).toHaveBeenCalledTimes(1);
    // The signal is what `app/_layout.tsx` listens to in order to purge the persisted cache and
    // the selected farm; clearing tokens alone leaves both on disk.
    expect(notifyAuthInvalidated).toHaveBeenCalledTimes(1);
  });

  it('signals only after the tokens are gone', async () => {
    const order: string[] = [];
    (clearTokens as jest.Mock).mockImplementation(async () => {
      order.push('clear');
    });
    (notifyAuthInvalidated as jest.Mock).mockImplementation(() => {
      order.push('notify');
    });

    await signOut();

    // The purge listener re-reads auth state; firing it first would race a token still present.
    expect(order).toEqual(['clear', 'notify']);
  });
});
