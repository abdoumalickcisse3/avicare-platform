import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { decodeJwtPayload, memberHasPermission } from "@/lib/permissions";

/**
 * Permissions the current user holds on `farmId`, read from the access JWT the
 * client already holds. `can` honors `*` / `resource:*` wildcards. Fail-closed:
 * no token, no membership, or an undefined farm → `can` is always false.
 */
export function useFarmPermissions(farmId: number | undefined): {
  can: (permission: string) => boolean;
} {
  const token = useAppSelector((s) => s.auth.accessToken);
  return useMemo(() => {
    const membership = decodeJwtPayload(token)?.memberships?.find((m) => m.farmId === farmId);
    const perms = membership?.permissions ?? [];
    return { can: (permission: string) => memberHasPermission(perms, permission) };
  }, [token, farmId]);
}
