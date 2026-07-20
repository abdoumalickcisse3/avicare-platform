export type MutationKind = 'DAILY_RECORD' | 'MORTALITY' | 'WEIGHING' | 'EGG_COLLECTION';

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
  createdAt: string;
};

export interface SqlDriver {
  exec(sql: string): void;
  run(sql: string, params: unknown[]): void;
  all<T>(sql: string, params: unknown[]): T[];
}
