import { useAppSelector } from "@/store/hooks";
import { decodeJwtPayload } from "@/lib/permissions";
import type { FarmRole } from "@/types";

/** The current user's role on `farmId`, read from the access JWT. Null if no membership/token. */
export function useFarmRole(farmId: number | undefined): FarmRole | null {
  const token = useAppSelector((s) => s.auth.accessToken);
  const membership = decodeJwtPayload(token)?.memberships?.find((m) => m.farmId === farmId);
  return (membership?.farmRole as FarmRole) ?? null;
}

/** Whether a role may add/edit/disable catalog entries (mirrors the backend OWNER/MANAGER gate). */
export function canManageCatalog(role: FarmRole | null): boolean {
  return role === "OWNER" || role === "MANAGER";
}
