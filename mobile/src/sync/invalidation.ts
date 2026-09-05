import type { MutationKind } from './types';

/**
 * The tags this module may ask for. Spelled out rather than derived, but not unchecked: the sole
 * caller hands the result to `baseApi.util.invalidateTags`, whose parameter is the API's own tag
 * union — so a tag renamed in `baseApi`, or misspelled here, fails to compile at that call site
 * instead of quietly invalidating nothing.
 */
type SyncTag =
  | 'Client'
  | 'DailyProduction'
  | 'DailyRecord'
  | 'Dashboard'
  | 'EggCollection'
  | 'Expense'
  | 'HealthAlert'
  | 'HealthSchedule'
  | 'InventoryAlert'
  | 'Observation'
  | 'Performance'
  | 'ProductionUnit'
  | 'StockItem'
  | 'StockMovement'
  | 'TrayStock'
  | 'Treatment'
  | 'UnitEvent'
  | 'Vaccination'
  | 'Weighing';

/**
 * What a synchronised mutation makes stale.
 *
 * <p>A field write goes through the queue, not through an RTK Query mutation, so nothing was
 * invalidating the read caches when the queue finally reached the server. The entry was safely on
 * the server and absent from the screen — for up to a minute, until the cache entry expired. The
 * sync ribbon said "0 en attente" while the list still showed nothing, which is the shape of a bug
 * even when the data is safe.
 *
 * <p>Tags are listed by type alone, without an id: RTK Query treats a bare type as "every entry
 * providing that type", which is what is wanted here — the drain knows the kind of write, not which
 * unit's list a screen happens to be showing. Only queries with a live subscription actually
 * refetch, so a farmer standing on the mortality screen does not pay for the egg lists.
 *
 * <p>Kinds are mapped one by one rather than invalidating everything on any success: on a field
 * phone with two bars, a blanket refetch of every cached list is exactly what must not happen.
 */
const TAGS_BY_KIND: Record<MutationKind, readonly SyncTag[]> = {
  // The headcount drops, the event ledger gains a row, and the server recomputes performance.
  MORTALITY: ['ProductionUnit', 'UnitEvent', 'Performance', 'Dashboard'],

  // A daily record also consumes feed: when the batch runs a formula, the server books one stock
  // movement per ingredient (D20), so the stock screens are stale too.
  DAILY_RECORD: [
    'DailyRecord',
    'Performance',
    'StockItem',
    'StockMovement',
    'InventoryAlert',
    'Dashboard',
  ],

  WEIGHING: ['Weighing', 'Performance'],

  EGG_COLLECTION: ['EggCollection', 'DailyProduction', 'TrayStock', 'Dashboard'],

  // The vaccination schedule marks a dose DONE from the recorded vaccinations.
  VACCINATION: ['Vaccination', 'HealthSchedule', 'HealthAlert'],

  HEALTH_OBSERVATION: ['Observation', 'HealthAlert'],

  TREATMENT: ['Treatment', 'HealthAlert'],

  CREATE_CLIENT: ['Client'],

  STOCK_ADJUSTMENT: ['StockItem', 'StockMovement', 'InventoryAlert', 'Dashboard'],

  EXPENSE: ['Expense', 'Dashboard'],
};

/**
 * The tags to invalidate after a drain sent these kinds. Deduplicated, since one pass commonly
 * carries several writes of the same kind, and order-stable so the result is easy to assert.
 */
export function tagsForKinds(kinds: readonly MutationKind[]): SyncTag[] {
  const tags: SyncTag[] = [];
  for (const kind of kinds) {
    for (const tag of TAGS_BY_KIND[kind] ?? []) {
      if (!tags.includes(tag)) tags.push(tag);
    }
  }
  return tags;
}
