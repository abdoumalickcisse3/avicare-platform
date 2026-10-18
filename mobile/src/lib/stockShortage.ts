/**
 * Un refus « stock insuffisant » (ADR-018), en miroir de `web/src/lib/stockShortage.ts`.
 *
 * Le backend ne se contente pas d'un message : il renvoie l'article et les deux quantités dans
 * les propriétés RFC 7807, précisément pour que l'écran puisse proposer le geste qui débloque au
 * lieu de laisser l'ouvrier devant un mur.
 *
 * La différence avec le web tient à l'endroit où le refus arrive. Sur le web, l'écran attend la
 * réponse et attrape l'erreur dans son `catch`. Sur le téléphone, toutes les saisies de terrain
 * passent par la file hors ligne : au moment du refus, l'écran de saisie est fermé depuis
 * longtemps, parfois depuis la veille. Le refus ressurgit dans la file d'attente, relu depuis
 * SQLite — d'où une lecture qui accepte les deux formes, la réponse vive et le problème rangé.
 */

/** Ce que le serveur dit du manque. */
export interface StockShortage {
  stockItemId: number;
  articleLabel: string;
  unit: string | null;
  available: number;
  requested: number;
}

/** La forme rangée en file : juste ce qu'il faut pour rejouer le geste. */
export type StoredProblem = { code?: string; properties?: Record<string, unknown> };

const CODE = 'STOCK_INSUFFICIENT';

function numberOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Le problème, qu'il vienne d'une réponse RTK Query (`{ data: { code, properties } }`) ou d'une
 * ligne de file déjà dépouillée (`{ code, properties }`).
 */
function problemOf(source: unknown): StoredProblem | null {
  if (!source || typeof source !== 'object') return null;
  const outer = source as { data?: unknown; code?: unknown; properties?: unknown };
  if (outer.data && typeof outer.data === 'object') return outer.data as StoredProblem;
  if (typeof outer.code === 'string') return outer as StoredProblem;
  return null;
}

/**
 * Le refus, ou `null` si l'erreur est autre chose.
 *
 * Rend `null` aussi quand le refus ne porte pas ses propriétés : ouvrir une fenêtre de réparation
 * vide serait pire que laisser le message passer. Le cas se produit quand l'application tourne
 * devant un backend antérieur à ADR-018 — ou quand la saisie a été refusée avant que la file ne
 * sache retenir les propriétés.
 */
export function stockShortage(source: unknown): StockShortage | null {
  const problem = problemOf(source);
  if (!problem || problem.code !== CODE || !problem.properties) return null;

  const p = problem.properties;
  const stockItemId = numberOf(p.stockItemId);
  const available = numberOf(p.available);
  const requested = numberOf(p.requested);
  if (stockItemId === null || available === null || requested === null) return null;

  return {
    stockItemId,
    articleLabel: typeof p.articleLabel === 'string' ? p.articleLabel : 'cet article',
    unit: typeof p.unit === 'string' ? p.unit : null,
    available,
    requested,
  };
}

/**
 * Ce qu'il manque pour que la sortie passe.
 *
 * C'est l'écart, pas la quantité demandée : sur une ligne déjà négative il faut d'abord combler
 * le trou. Pré-remplir la demande seule laisserait le solde sous zéro et le geste échouerait une
 * seconde fois.
 */
export function missingQuantity(shortage: Pick<StockShortage, 'available' | 'requested'>): number {
  return shortage.requested - shortage.available;
}
