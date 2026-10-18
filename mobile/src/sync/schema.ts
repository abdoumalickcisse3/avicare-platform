// SQLite schema for the offline mutation queue.
// The queue is a durable buffer of pending field-data writes, not an audit
// journal: rows are removed on success (markDone) and only linger when a
// mutation failed terminally (status = 'FAILED') pending user retry.
import type { SqlDriver } from './types';

export const QUEUE_SCHEMA = `
CREATE TABLE IF NOT EXISTS mutation_queue (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  client_ref   TEXT NOT NULL UNIQUE,
  farm_id      INTEGER NOT NULL,
  kind         TEXT NOT NULL,
  endpoint     TEXT NOT NULL,
  payload      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'PENDING',
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  last_problem TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mutation_queue_status ON mutation_queue (status, id);
`;

/**
 * Colonnes ajoutées après coup, posées sur les installations déjà en place.
 *
 * `CREATE TABLE IF NOT EXISTS` ne touche pas une table existante : sans ça, un téléphone qui a
 * déjà tourné garderait à jamais le schéma du jour de son installation, et la lecture du refus
 * échouerait silencieusement — chez l'éleveur, pas chez nous. SQLite ne connaît pas
 * `ADD COLUMN IF NOT EXISTS`, d'où l'inspection préalable plutôt qu'un `try/catch` qui avalerait
 * aussi les vraies erreurs.
 */
const ADDED_COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'last_problem', ddl: `ALTER TABLE mutation_queue ADD COLUMN last_problem TEXT` },
];

export function migrateQueue(driver: SqlDriver): void {
  const existing = new Set(
    driver.all<{ name: string }>(`PRAGMA table_info(mutation_queue)`, []).map((c) => c.name),
  );
  for (const column of ADDED_COLUMNS) {
    if (!existing.has(column.name)) driver.exec(column.ddl);
  }
}
