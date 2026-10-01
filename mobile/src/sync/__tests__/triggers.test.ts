import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { startSyncTriggers } from '../triggers';
import { syncEngine } from '../index';

jest.mock('../index', () => ({ syncEngine: { drain: jest.fn() } }));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn() },
}));

const drain = syncEngine.drain as jest.Mock;
const done = { sent: 1, failed: 0, retryable: 0, sentKinds: [] };
const stuck = { sent: 0, failed: 0, retryable: 1, sentKinds: [] };

type NetListener = (s: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void;
let netListener: NetListener;
let appListener: (s: string) => void;
const unsubscribeNet = jest.fn();
const removeApp = jest.fn();

describe('startSyncTriggers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    drain.mockResolvedValue(done);
    (NetInfo.addEventListener as jest.Mock).mockImplementation((l: NetListener) => {
      netListener = l;
      return unsubscribeNet;
    });
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, l: (s: string) => void) => {
      appListener = l;
      return { remove: removeApp };
    }) as never);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('sends what the previous session left behind as soon as it starts', async () => {
    const stop = startSyncTriggers();
    expect(drain).toHaveBeenCalledTimes(1);
    stop();
  });

  it('drains when the connection comes back, and on foreground', async () => {
    const stop = startSyncTriggers();
    drain.mockClear();

    netListener({ isConnected: false, isInternetReachable: false });
    expect(drain).not.toHaveBeenCalled();
    netListener({ isConnected: true, isInternetReachable: true });
    expect(drain).toHaveBeenCalledTimes(1);

    appListener('active');
    expect(drain).toHaveBeenCalledTimes(2);
    appListener('background');
    expect(drain).toHaveBeenCalledTimes(2);
    stop();
  });

  it('treats wifi with no internet as offline, and drains when internet returns on the same wifi', async () => {
    const stop = startSyncTriggers();
    drain.mockClear();

    netListener({ isConnected: true, isInternetReachable: false });
    netListener({ isConnected: true, isInternetReachable: true });

    expect(drain).toHaveBeenCalledTimes(1);
    stop();
  });

  it('retries on its own with a growing delay while entries are still waiting', async () => {
    drain.mockResolvedValue(stuck);
    const stop = startSyncTriggers();
    await jest.advanceTimersByTimeAsync(0);
    expect(drain).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(2_000);
    expect(drain).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(3_999);
    expect(drain).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(drain).toHaveBeenCalledTimes(3);
    stop();
  });

  it('stops retrying once the queue is empty', async () => {
    drain.mockResolvedValueOnce(stuck).mockResolvedValue(done);
    const stop = startSyncTriggers();
    await jest.advanceTimersByTimeAsync(2_000);
    const calls = drain.mock.calls.length;

    await jest.advanceTimersByTimeAsync(60_000);

    expect(drain).toHaveBeenCalledTimes(calls);
    stop();
  });

  it('cancels the retry and the listeners when stopped', async () => {
    drain.mockResolvedValue(stuck);
    const stop = startSyncTriggers();
    await jest.advanceTimersByTimeAsync(0);
    stop();
    drain.mockClear();

    await jest.advanceTimersByTimeAsync(10 * 60_000);

    expect(drain).not.toHaveBeenCalled();
    expect(unsubscribeNet).toHaveBeenCalled();
    expect(removeApp).toHaveBeenCalled();
  });
});
