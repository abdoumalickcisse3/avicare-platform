/**
 * Reactive access to the decoded JWT session (role + farm memberships) and the
 * permission helpers the role-aware navigation needs. The token lives in
 * SecureStore (async), so this reads it once on mount; it re-reads when the
 * selected farm changes so `can()` reflects the right membership.
 *
 * Role model (mirrors the web): a platform `ADMIN` or a farm `OWNER` is
 * "admin-like" — sees every section (drawer + full tabs). Everyone else is
 * gated by their per-farm `resource:read` permissions, exactly like the web
 * sidebar (`useFarmPermissions`).
 */
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { getAccessToken } from '@/auth/tokens';
import { decodeSession, type Session } from '@/auth/session';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';

export type FarmAccess = {
  session: Session | null;
  /** Platform ADMIN or farm OWNER — the "full menu + drawer" tier. */
  isAdmin: boolean;
  /** The current farm membership's role (OWNER/MANAGER/FARMER/VETERINARIAN), if any. */
  farmRole: string | undefined;
  /** Whether the current farm membership grants a `resource:read` permission. */
  can: (permission: string) => boolean;
};

export function useFarmAccess(): FarmAccess {
  const [session, setSession] = useState<Session | null>(null);
  const selectedFarmId = useSelector(selectSelectedFarmId);

  useEffect(() => {
    let cancelled = false;
    getAccessToken()
      .then((token) => {
        if (cancelled || !token) return;
        try {
          setSession(decodeSession(token));
        } catch {
          // Malformed token — the route guard handles the redirect; leave session null.
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const membership = session?.memberships.find((m) => m.farmId === selectedFarmId);
  const isAdmin = session?.role === 'ADMIN' || membership?.farmRole === 'OWNER';
  const perms = membership?.permissions ?? [];

  return {
    session,
    isAdmin: Boolean(isAdmin),
    farmRole: membership?.farmRole,
    // Honor the "*" and "resource:*" wildcards (mirrors the web's
    // memberHasPermission) so a MANAGER holding "poultry:*" passes
    // can("poultry:write"), not just an exact-string match.
    can: (permission: string) => {
      if (isAdmin || perms.includes('*') || perms.includes(permission)) return true;
      const resource = permission.split(':')[0];
      return perms.includes(`${resource}:*`);
    },
  };
}
