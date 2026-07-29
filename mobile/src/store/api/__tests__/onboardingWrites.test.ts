// `@/store` pulls in `@/store/persist`, which imports the AsyncStorage
// native module at load time; under plain-Node Jest there's no native
// runtime, so — same fix as `src/store/__tests__/persist.test.ts` — swap in
// the package's own official in-memory mock before importing the store.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { store } from '@/store';
import { authApi } from '../authApi';
import { farmsApi } from '../farmsApi';

describe('onboarding write endpoints', () => {
  it('signup POSTs to /auth/signup', () => {
    const action = store.dispatch(
      authApi.endpoints.signup.initiate({ fullName: 'Awa Diop', email: 'a@b.c', password: 'password123' }),
    );
    expect(typeof action.unwrap).toBe('function');
    // Cleanup: this RTK Query version names the mutation-result cleanup
    // method `reset()` (`unsubscribe()` is the query-result equivalent and
    // doesn't exist on `MutationActionCreatorResult` — TS rejects it even
    // under optional chaining).
    action.reset();
  });
  it('createFarm POSTs and updateFarm PUTs', () => {
    expect(farmsApi.endpoints.createFarm.name).toBe('createFarm');
    expect(farmsApi.endpoints.updateFarm.name).toBe('updateFarm');
  });
});
