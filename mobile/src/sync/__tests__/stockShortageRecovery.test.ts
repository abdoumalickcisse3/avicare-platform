import Database from 'better-sqlite3';
import { createFakeDriver } from './fakeDriver';
import { createQueue } from '../queue';
import { QUEUE_SCHEMA, migrateQueue } from '../schema';
import { createEngine } from '../engine';
import { stockShortage } from '@/lib/stockShortage';
import type { QueuedMutation, SqlDriver } from '../types';

const PROPERTIES = {
  stockItemId: 7,
  articleLabel: 'Aliment démarrage',
  unit: 'sac',
  available: 0,
  requested: 2,
};

function seededQueue() {
  const driver = createFakeDriver();
  driver.exec(QUEUE_SCHEMA);
  const queue = createQueue(driver);
  queue.enqueue({
    clientRef: 'ref-1',
    farmId: 22,
    kind: 'DAILY_RECORD',
    endpoint: '/api/v1/farms/22/daily-records',
    payload: { feedKg: 2 },
  });
  return { driver, queue };
}

describe('un refus « stock insuffisant » arrivé par la file', () => {
  it('garde de quoi réparer, pas seulement de quoi lire', async () => {
    const { queue } = seededQueue();

    await createEngine({
      queue,
      transport: async () => ({
        status: 422,
        body: {
          code: 'STOCK_INSUFFICIENT',
          detail: 'Stock insuffisant : il reste 0 sac de Aliment démarrage, vous en sortez 2.',
          properties: PROPERTIES,
        },
      }),
    }).drain();

    const failed = queue.listFailed()[0]!;
    expect(failed.status).toBe('FAILED');
    // Le message reste lisible tel quel…
    expect(failed.lastError).toContain('Stock insuffisant');
    // …et l'écran sait désormais QUEL article corriger et de combien.
    expect(stockShortage(failed.lastProblem)).toEqual({
      stockItemId: 7,
      articleLabel: 'Aliment démarrage',
      unit: 'sac',
      available: 0,
      requested: 2,
    });
  });

  it('ne retient rien de réparable quand le refus est ordinaire', async () => {
    const { queue } = seededQueue();

    await createEngine({
      queue,
      transport: async () => ({ status: 403, body: { code: 'FORBIDDEN', detail: 'Accès refusé.' } }),
    }).drain();

    const failed = queue.listFailed()[0]!;
    expect(failed.lastError).toBe('Accès refusé.');
    expect(stockShortage(failed.lastProblem)).toBeNull();
  });

  it('oublie le problème quand la saisie repart — sinon la correction resterait proposée', () => {
    const { queue } = seededQueue();
    const id = queue.peekNext()!.id;
    queue.markFailed(id, 'Stock insuffisant', { code: 'STOCK_INSUFFICIENT', properties: PROPERTIES });

    queue.markPending(id);

    expect(queue.peekNext()!.lastProblem).toBeNull();
  });

  it('survit à une colonne illisible plutôt que de faire tomber la file', () => {
    const { driver, queue } = seededQueue();
    driver.run(`UPDATE mutation_queue SET status = 'FAILED', last_problem = ? WHERE id = 1`, ['{pas du json']);

    expect(queue.listFailed()[0]!.lastProblem).toBeNull();
  });
});

describe('migrateQueue', () => {
  /** Le schéma tel qu'il était avant ADR-018, sans `last_problem`. */
  function legacyDriver(): SqlDriver {
    const db = new Database(':memory:');
    db.exec(`CREATE TABLE mutation_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT, client_ref TEXT NOT NULL UNIQUE, farm_id INTEGER NOT NULL,
      kind TEXT NOT NULL, endpoint TEXT NOT NULL, payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING', attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT, created_at TEXT NOT NULL)`);
    return {
      exec: (sql) => void db.exec(sql),
      run: (sql, params) => void db.prepare(sql).run(...(params as never[])),
      all: <T>(sql: string, params: unknown[]) => db.prepare(sql).all(...(params as never[])) as T[],
    };
  }

  it('ajoute la colonne au téléphone déjà installé', () => {
    // `CREATE TABLE IF NOT EXISTS` ne touche pas une table existante : sans migration, un
    // téléphone en service garderait le schéma de son installation et la réparation serait
    // morte chez l'éleveur, pas chez nous.
    const driver = legacyDriver();
    const columns = () => driver.all<{ name: string }>(`PRAGMA table_info(mutation_queue)`, []).map((c) => c.name);
    expect(columns()).not.toContain('last_problem');

    migrateQueue(driver);

    expect(columns()).toContain('last_problem');
  });

  it('se rejoue sans erreur', () => {
    const driver = legacyDriver();
    migrateQueue(driver);
    expect(() => migrateQueue(driver)).not.toThrow();
  });

  it('laisse intactes les saisies déjà en file', () => {
    const driver = legacyDriver();
    driver.run(
      `INSERT INTO mutation_queue (client_ref, farm_id, kind, endpoint, payload, status, attempts, created_at)
       VALUES ('ref-ancien', 22, 'MORTALITY', '/x', '{"dead":3}', 'PENDING', 0, '2026-10-01T08:00:00Z')`,
      [],
    );

    migrateQueue(driver);

    const rows = createQueue(driver).listAll();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.clientRef).toBe('ref-ancien');
    expect(rows[0]!.lastProblem).toBeNull();
  });
});

/** Garde-fou de typage : la file expose bien le champ au reste de l'app. */
export type _ = QueuedMutation['lastProblem'];
