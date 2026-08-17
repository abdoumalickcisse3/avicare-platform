import { authApi } from '../authApi';

describe('authApi profile', () => {
  it('exposes getProfile and updateProfile with hooks', () => {
    expect(authApi.endpoints.getProfile.name).toBe('getProfile');
    expect(authApi.endpoints.updateProfile.name).toBe('updateProfile');
    expect(typeof authApi.useGetProfileQuery).toBe('function');
    expect(typeof authApi.useUpdateProfileMutation).toBe('function');
  });
});
