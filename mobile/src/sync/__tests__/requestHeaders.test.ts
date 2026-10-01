import { requestHeaders } from '../requestHeaders';

describe('requestHeaders', () => {
  const ref = '3f2b8c1e-5d4a-4e7b-9c10-0a1b2c3d4e5f';

  it('sends the queue entry id as the idempotency key', () => {
    expect(requestHeaders({ clientRef: ref }, 'tok')).toEqual({
      'Content-Type': 'application/json',
      'Idempotency-Key': ref,
      Authorization: 'Bearer tok',
    });
  });

  it('leaves out a ref that is not a UUID', () => {
    expect(requestHeaders({ clientRef: 'abc' }, 'tok')).not.toHaveProperty('Idempotency-Key');
  });

  it('omits Authorization without a token', () => {
    expect(requestHeaders({ clientRef: ref }, null)).not.toHaveProperty('Authorization');
  });
});
