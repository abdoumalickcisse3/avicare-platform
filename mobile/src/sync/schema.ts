// SQLite schema for the offline mutation queue.
// The queue is a durable buffer of pending field-data writes, not an audit
// journal: rows are removed on success (markDone) and only linger when a
// mutation failed terminally (status = 'FAILED') pending user retry.
export const QUEUE_SCHEMA = `
CREATE TABLE IF NOT EXISTS mutation_queue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_ref  TEXT NOT NULL UNIQUE,
  farm_id     INTEGER NOT NULL,
  kind        TEXT NOT NULL,
  endpoint    TEXT NOT NULL,
  payload     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'PENDING',
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mutation_queue_status ON mutation_queue (status, id);
`;
