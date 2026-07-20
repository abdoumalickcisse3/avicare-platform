import { openDatabaseSync } from 'expo-sqlite';
import type { SqlDriver } from './types';

// Production SqlDriver, backed by expo-sqlite's synchronous API. This is a
// thin adapter with no unit test — expo-sqlite requires a native runtime and
// cannot execute under Jest. queue.ts is tested against the exact same
// SqlDriver interface via a better-sqlite3 fake (see __tests__/fakeDriver.ts),
// so correctness of the queue logic is covered there; this file only needs
// to be an obviously-correct pass-through to the native SQLite database.
export function createSqliteDriver(databaseName = 'avicare.db'): SqlDriver {
  const db = openDatabaseSync(databaseName);
  return {
    exec: (sql) => {
      db.execSync(sql);
    },
    run: (sql, params) => {
      db.runSync(sql, params as never[]);
    },
    all: <T>(sql: string, params: unknown[]) => db.getAllSync(sql, params as never[]) as T[],
  };
}
