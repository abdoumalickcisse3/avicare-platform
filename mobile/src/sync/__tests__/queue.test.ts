import { createFakeDriver } from './fakeDriver';
import { createQueue } from '../queue';
import { QUEUE_SCHEMA } from '../schema';

function setup() {
  const driver = createFakeDriver();
  driver.exec(QUEUE_SCHEMA);
  return createQueue(driver);
}

const mutation = {
  clientRef: 'ref-1',
  farmId: 7,
  kind: 'MORTALITY' as const,
  endpoint: '/api/v1/farms/7/production-units/3/mortality',
  payload: { count: 2, reason: 'field' },
};

describe('mutation queue', () => {
  it('returns mutations in insertion order', () => {
    const q = setup();
    q.enqueue({ ...mutation, clientRef: 'a' });
    q.enqueue({ ...mutation, clientRef: 'b' });
    expect(q.peekNext()?.clientRef).toBe('a');
  });

  it('removes a mutation once done', () => {
    const q = setup();
    q.enqueue(mutation);
    const next = q.peekNext();
    q.markDone(next!.id);
    expect(q.peekNext()).toBeNull();
    expect(q.countPending()).toBe(0);
  });

  it('rejects a duplicate clientRef', () => {
    const q = setup();
    q.enqueue(mutation);
    expect(() => q.enqueue(mutation)).toThrow();
  });

  it('skips failed mutations when peeking', () => {
    const q = setup();
    q.enqueue(mutation);
    q.markFailed(q.peekNext()!.id, 'Effectif insuffisant');
    expect(q.peekNext()).toBeNull();
    expect(q.listFailed()).toHaveLength(1);
    expect(q.listFailed()[0]?.lastError).toBe('Effectif insuffisant');
  });

  it('counts only pending mutations', () => {
    const q = setup();
    q.enqueue({ ...mutation, clientRef: 'a' });
    q.enqueue({ ...mutation, clientRef: 'b' });
    q.markFailed(q.peekNext()!.id, 'boom');
    expect(q.countPending()).toBe(1);
  });

  it('round-trips the payload as JSON', () => {
    const q = setup();
    q.enqueue(mutation);
    expect(q.peekNext()?.payload).toEqual({ count: 2, reason: 'field' });
  });
});
