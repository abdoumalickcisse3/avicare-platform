/**
 * Permission arithmetic for the member sheet.
 *
 * The backend stores permissions as `resource:verb` strings with two wildcards — `"*"` for
 * everything and `"resource:*"` for a whole module. The UI needs the expanded set to draw the
 * toggles, and sends back the expanded set, which the server accepts as-is.
 */
import type { PermissionCatalog } from '@/types';

export const VERB_LABELS: Record<string, string> = {
  read: 'Voir',
  write: 'Saisir',
  delete: 'Supprimer',
  consume: 'Consommer',
};

/** Falls back to the raw verb so a future backend verb still renders something usable. */
export function verbLabel(verb: string): string {
  return VERB_LABELS[verb] ?? verb;
}

/** Expand `"*"` and `"resource:*"` into the concrete `resource:verb` strings the catalog knows. */
export function expandPermissions(perms: string[], catalog: PermissionCatalog): Set<string> {
  const out = new Set<string>();
  const all = perms.includes('*');
  for (const r of catalog.resources) {
    for (const v of r.verbs) {
      if (all || perms.includes(`${r.resource}:*`) || perms.includes(`${r.resource}:${v}`)) {
        out.add(`${r.resource}:${v}`);
      }
    }
  }
  return out;
}

/**
 * Verbs that need a screen of their own, and therefore need `read` alongside them.
 *
 * `consume` is deliberately absent. The platform's own FARMER baseline is
 * `inventory:consume` without `inventory:read`: a field worker draws feed from stock through the
 * daily-entry screen, and never opens the stock section. Implying `read` there would silently
 * grant more than the role it was copied from.
 */
const NEEDS_READ = new Set(['write', 'delete']);

/**
 * Toggle one verb, keeping the result usable.
 *
 * Granting `write` or `delete` also grants `read` on the same module, and revoking `read` revokes
 * them in turn. That is not decoration: the app gates its menu and every list on `resource:read`,
 * so a member given `poultry:write` alone gets an account that can technically write and cannot
 * reach a single screen to do it. The backend accepts that combination; a person cannot use it.
 */
export function toggleVerb(
  current: Set<string>,
  resource: string,
  verb: string,
  on: boolean,
  verbs: string[],
): string[] {
  const next = new Set(current);
  if (on) {
    next.add(`${resource}:${verb}`);
    if (NEEDS_READ.has(verb) && verbs.includes('read')) next.add(`${resource}:read`);
  } else {
    next.delete(`${resource}:${verb}`);
    // Revoking the ability to see a module revokes acting on it — but not `consume`, which is
    // exercised from another module's screen.
    if (verb === 'read') for (const v of verbs) if (NEEDS_READ.has(v)) next.delete(`${resource}:${v}`);
  }
  return [...next].sort();
}

/** How many verbs are granted on a module — drives the collapsed summary line. */
export function grantedCount(selected: Set<string>, resource: string, verbs: string[]): number {
  return verbs.filter((v) => selected.has(`${resource}:${v}`)).length;
}

/** True when the selection is exactly the role's baseline, so the sheet can say so. */
export function matchesRoleDefaults(
  selected: Set<string>,
  role: string,
  catalog: PermissionCatalog,
): boolean {
  const defaults = expandPermissions(catalog.roleDefaults[role] ?? [], catalog);
  if (defaults.size !== selected.size) return false;
  for (const p of defaults) if (!selected.has(p)) return false;
  return true;
}
