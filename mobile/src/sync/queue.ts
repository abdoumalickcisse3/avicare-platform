import type { MutationStatus, QueuedMutation, SqlDriver } from './types';

// Raw shape of a `mutation_queue` row as returned by SqlDriver.all/run —
// snake_case columns, payload still JSON text, status still a plain string.
type MutationRow = {
  id: number;
  client_ref: string;
  farm_id: number;
  kind: QueuedMutation['kind'];
  endpoint: string;
  payload: string;
  status: MutationStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
};

function toQueuedMutation(row: MutationRow): QueuedMutation {
  return {
    id: row.id,
    clientRef: row.client_ref,
    farmId: row.farm_id,
    kind: row.kind,
    endpoint: row.endpoint,
    payload: JSON.parse(row.payload) as unknown,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    createdAt: row.created_at,
  };
}

export function createQueue(driver: SqlDriver) {
  return {
    enqueue(m: Omit<QueuedMutation, 'id' | 'status' | 'attempts' | 'lastError' | 'createdAt'>): void {
      driver.run(
        `INSERT INTO mutation_queue (client_ref, farm_id, kind, endpoint, payload, status, attempts, last_error, created_at)
         VALUES (?, ?, ?, ?, ?, 'PENDING', 0, NULL, ?)`,
        [m.clientRef, m.farmId, m.kind, m.endpoint, JSON.stringify(m.payload), new Date().toISOString()],
      );
    },

    peekNext(): QueuedMutation | null {
      const rows = driver.all<MutationRow>(
        `SELECT * FROM mutation_queue WHERE status IN ('PENDING', 'IN_FLIGHT') ORDER BY id LIMIT 1`,
        [],
      );
      const row = rows[0];
      return row ? toQueuedMutation(row) : null;
    },

    markDone(id: number): void {
      driver.run(`DELETE FROM mutation_queue WHERE id = ?`, [id]);
    },

    // attempts is owned solely by bumpAttempts — markFailed only records the
    // terminal state, it must never touch the counter (avoids double-count
    // when the sync engine calls bumpAttempts on retryable errors).
    markFailed(id: number, message: string): void {
      driver.run(`UPDATE mutation_queue SET status = 'FAILED', last_error = ? WHERE id = ?`, [message, id]);
    },

    markPending(id: number): void {
      driver.run(`UPDATE mutation_queue SET status = 'PENDING', last_error = NULL WHERE id = ?`, [id]);
    },

    bumpAttempts(id: number): void {
      driver.run(`UPDATE mutation_queue SET attempts = attempts + 1 WHERE id = ?`, [id]);
    },

    countPending(): number {
      const rows = driver.all<{ count: number }>(
        `SELECT COUNT(*) as count FROM mutation_queue WHERE status IN ('PENDING', 'IN_FLIGHT')`,
        [],
      );
      return rows[0]?.count ?? 0;
    },

    listFailed(): QueuedMutation[] {
      const rows = driver.all<MutationRow>(`SELECT * FROM mutation_queue WHERE status = 'FAILED' ORDER BY id`, []);
      return rows.map(toQueuedMutation);
    },

    listAll(): QueuedMutation[] {
      const rows = driver.all<MutationRow>(`SELECT * FROM mutation_queue ORDER BY id`, []);
      return rows.map(toQueuedMutation);
    },
  };
}
