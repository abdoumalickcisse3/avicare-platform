import Database from 'better-sqlite3';
import type { SqlDriver } from '../types';

// Test-only driver: runs the real SQL against an in-memory better-sqlite3
// database, so queue.test.ts exercises the actual queries (CREATE TABLE,
// UNIQUE constraint, ORDER BY) instead of a mock that could lie about them.
// expo-sqlite requires a native runtime and cannot run under Jest — see
// driver.ts for the production adapter with the identical SqlDriver shape.
export function createFakeDriver(): SqlDriver {
  const db = new Database(':memory:');
  return {
    exec: (sql) => {
      db.exec(sql);
    },
    run: (sql, params) => {
      db.prepare(sql).run(...(params as never[]));
    },
    all: <T>(sql: string, params: unknown[]) => db.prepare(sql).all(...(params as never[])) as T[],
  };
}
