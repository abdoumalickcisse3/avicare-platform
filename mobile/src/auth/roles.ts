/**
 * Pure role predicates — who may write what, mirroring the backend's own gates.
 *
 * Deliberately in their own module rather than beside `useFarmAccess`: screens mock
 * `@/auth/useSession` wholesale in tests, and a predicate living there would vanish with the mock.
 * These take plain values, so they need no mocking at all.
 */
/**
 * Whether this access may perform a *supervisory* write — the OWNER/MANAGER tier.
 *
 * Mirrors the web's `canManageCatalog`, and behind it the backend's own rule: `WRITE_MANAGER` in
 * {@code InventoryAccess}, {@code CommercialAccess}, {@code FinanceAccess} and {@code HealthAccess}
 * is `hasRole(farmId, OWNER, MANAGER)` — a **role**, never a permission.
 *
 * The distinction is not cosmetic. `can('inventory:write')` and this are different questions: a
 * FARMER granted `inventory:write` (the catalogue offers that verb) passes the permission and is
 * still refused by the backend, while a MANAGER whose permissions were narrowed fails it and would
 * have been allowed. Both were happening — a shared function is what stops the two drifting again.
 *
 * Field writes stay on permissions (`poultry:write`, `health:write`): those really are gated by
 * permission server-side.
 */
export function canManageFarm(farmRole: string | undefined, isAdmin: boolean): boolean {
  return isAdmin || farmRole === 'OWNER' || farmRole === 'MANAGER';
}

/**
 * Whether this access may perform a *field* write — the OWNER/MANAGER/FARMER tier.
 *
 * The backend's other role gate: `WRITE_FARMER` in {@code InventoryAccess} and {@code
 * CommercialAccess} is `hasRole(farmId, OWNER, MANAGER, FARMER)`. Recording a stock movement is a
 * field act and the farm hand is meant to do it — but their default permissions carry
 * `inventory:consume`, not `inventory:write`, so gating it on the permission locked the very
 * person the phone is built for out of their own stock entry.
 */
export function canOperateFarm(farmRole: string | undefined, isAdmin: boolean): boolean {
  return canManageFarm(farmRole, isAdmin) || farmRole === 'FARMER';
}
