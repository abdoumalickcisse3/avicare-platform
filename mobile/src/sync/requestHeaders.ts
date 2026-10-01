import type { QueuedMutation } from './types';

// The queue entry's id doubles as the idempotency key: when a connection dies after the server wrote
// but before the answer came back, the replay carries the same key and gets the first answer back
// instead of writing twice. A non-UUID ref is left out — the server ignores a malformed key anyway.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requestHeaders(
  mutation: Pick<QueuedMutation, 'clientRef'>,
  token: string | null | undefined,
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(UUID.test(mutation.clientRef) ? { 'Idempotency-Key': mutation.clientRef } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
