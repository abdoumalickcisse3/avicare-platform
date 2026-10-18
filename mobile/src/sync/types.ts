import type { StoredProblem } from '@/lib/stockShortage';

export type MutationKind =
  | 'DAILY_RECORD'
  | 'MORTALITY'
  | 'WEIGHING'
  | 'EGG_COLLECTION'
  | 'VACCINATION'
  | 'HEALTH_OBSERVATION'
  | 'CREATE_CLIENT'
  | 'STOCK_ADJUSTMENT'
  // Added for the parity effort (spec 2026-08-30, D1): writes a farmer makes standing in a
  // barn. Money writes — payments, sales, invoices — deliberately stay online: the server
  // only deduplicates mortality and weighings today, so a replayed payment would create a
  // second one.
  | 'EXPENSE'
  | 'TREATMENT';

export type MutationStatus = 'PENDING' | 'IN_FLIGHT' | 'FAILED';

export type QueuedMutation = {
  id: number;
  clientRef: string;
  farmId: number;
  kind: MutationKind;
  endpoint: string;
  payload: unknown;
  status: MutationStatus;
  attempts: number;
  lastError: string | null;
  /**
   * Le problème RFC 7807 du dernier refus, réduit à ce qui permet d'agir : son code et ses
   * propriétés. Le message seul ne suffit pas — « il reste 0 sac de X » se lit, mais ne dit pas
   * à l'écran QUEL article corriger ni de combien.
   */
  lastProblem: StoredProblem | null;
  createdAt: string;
};

export interface SqlDriver {
  exec(sql: string): void;
  run(sql: string, params: unknown[]): void;
  all<T>(sql: string, params: unknown[]): T[];
}
