import { isOnline } from '../isOnline';

describe('isOnline', () => {
  it('is offline when the device has no connection', () => {
    expect(isOnline({ isConnected: false, isInternetReachable: false })).toBe(false);
    expect(isOnline({ isConnected: null, isInternetReachable: null })).toBe(false);
  });

  it('is offline on a network that is joined but has no internet (wifi without data)', () => {
    expect(isOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
  });

  it('is online when connected and reachability is still being probed (null)', () => {
    expect(isOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
  });

  it('is online when connected and reachable', () => {
    expect(isOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
  });
});
