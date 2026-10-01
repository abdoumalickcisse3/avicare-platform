// fetch has no timeout of its own: on a flaky mobile network a request can hang for minutes, and a
// screen waiting on it shows a spinner the whole time. Past this, the request fails and the caller
// can offer a retry.
export const REQUEST_TIMEOUT_MS = 20_000;

/** `fetch` that gives up after `ms` — for calls made outside RTK Query, which has its own timeout. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
