/** `isConnected` alone stays true on wifi with no internet; `isInternetReachable` is null while unprobed. */
export function isOnline(state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}
