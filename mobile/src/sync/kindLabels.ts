import type { MutationKind } from './types';

/**
 * French label for each queued mutation kind.
 *
 * Kept beside the kinds rather than inside the queue screen: the screen is one reader, and a
 * kind added without its label shows `undefined` to a farmer trying to understand why a day's
 * entry never left the phone. The queue screen is the only place a terminal failure can be
 * seen or resolved, so it is the last place that should be vague.
 */
export const KIND_LABELS: Record<MutationKind, string> = {
  DAILY_RECORD: 'Journalier',
  MORTALITY: 'Mortalité',
  WEIGHING: 'Pesée',
  EGG_COLLECTION: "Collecte d'œufs",
  VACCINATION: 'Vaccination',
  HEALTH_OBSERVATION: 'Observation santé',
  CREATE_CLIENT: 'Nouveau client',
  STOCK_ADJUSTMENT: 'Ajustement stock',
  EXPENSE: 'Dépense',
  TREATMENT: 'Traitement',
};
